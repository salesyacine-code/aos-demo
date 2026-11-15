import amqp from 'amqplib';
import { RABBITMQ_CONFIG } from '../../../shared/contracts.js';
import { generateDocumentPdf } from './pdfGenerator.js';
import { documentStore } from './documentStore.js';

class DocumentConsumer {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isListening = false;
    this.url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  }

  async start(retries = 15, delayMs = 3000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[DocumentService] Connecting to RabbitMQ at ${this.url} (Attempt ${attempt}/${retries})...`);
        this.connection = await amqp.connect(this.url);
        this.channel = await this.connection.createChannel();

        await this.channel.assertExchange(RABBITMQ_CONFIG.EXCHANGE, RABBITMQ_CONFIG.EXCHANGE_TYPE, {
          durable: true
        });

        const q = RABBITMQ_CONFIG.QUEUES.DOCUMENT_GENERATION;
        await this.channel.assertQueue(q, { durable: true });
        await this.channel.bindQueue(q, RABBITMQ_CONFIG.EXCHANGE, RABBITMQ_CONFIG.ROUTING_KEYS.REQUEST_APPROVED);

        await this.channel.prefetch(1);

        this.channel.consume(q, async (msg) => {
          if (!msg) return;
          try {
            const event = JSON.parse(msg.content.toString());
            console.log(`[DocumentConsumer] Consumed ${msg.fields.routingKey}: ${event.eventId}`);
            const payload = event.payload;

            const pdfResult = await generateDocumentPdf(
              payload,
              process.env.GATEWAY_PUBLIC_URL || 'http://localhost:8000'
            );

            documentStore.recordDocument({
              requestId: payload.requestId,
              requestNumber: payload.requestNumber,
              documentId: pdfResult.documentId,
              documentType: payload.documentType,
              fileName: pdfResult.fileName,
              studentName: payload.student.fullName,
              studentNumber: payload.student.studentNumber,
              verificationUrl: pdfResult.verificationUrl,
              generatedAt: new Date().toISOString()
            });

            console.log(`[DocumentConsumer] PDF generated: ${pdfResult.fileName} (DocID: ${pdfResult.documentId})`);
            this.channel.ack(msg);
          } catch (procErr) {
            console.error('[DocumentConsumer] Error processing message:', procErr.message);
            this.channel.nack(msg, false, false);
          }
        });

        this.isListening = true;
        console.log(`[DocumentService] Consumer registered on queue "${q}"`);

        this.connection.on('error', (err) => {
          console.error('[DocumentService] RabbitMQ Connection error:', err.message);
          this.isListening = false;
        });

        this.connection.on('close', () => {
          console.warn('[DocumentService] RabbitMQ Connection closed. Retrying in 5s...');
          this.isListening = false;
          setTimeout(() => this.start(), 5000);
        });

        return;
      } catch (err) {
        console.warn(`[DocumentService] RabbitMQ attempt ${attempt} failed: ${err.message}`);
        if (attempt === retries) {
          console.warn('[DocumentService] RabbitMQ not reachable yet. Will retry in 10s.');
          setTimeout(() => this.start(), 10000);
          return;
        }
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
}

export const documentConsumer = new DocumentConsumer();
