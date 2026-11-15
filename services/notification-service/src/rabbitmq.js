import amqp from 'amqplib';
import { RABBITMQ_CONFIG } from '../../../shared/contracts.js';
import { sendApprovalEmail, sendRejectionEmail } from './mailer.js';
import { notificationStore } from './notificationStore.js';

class NotificationConsumer {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isListening = false;
    this.url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  }

  async start(retries = 15, delayMs = 3000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[NotificationService] Connecting to RabbitMQ at ${this.url} (Attempt ${attempt}/${retries})...`);
        this.connection = await amqp.connect(this.url);
        this.channel = await this.connection.createChannel();

        await this.channel.assertExchange(RABBITMQ_CONFIG.EXCHANGE, RABBITMQ_CONFIG.EXCHANGE_TYPE, {
          durable: true
        });

        const q = RABBITMQ_CONFIG.QUEUES.NOTIFICATION;
        await this.channel.assertQueue(q, { durable: true });
        await this.channel.bindQueue(q, RABBITMQ_CONFIG.EXCHANGE, RABBITMQ_CONFIG.ROUTING_KEYS.REQUEST_APPROVED);
        await this.channel.bindQueue(q, RABBITMQ_CONFIG.EXCHANGE, RABBITMQ_CONFIG.ROUTING_KEYS.REQUEST_REJECTED);

        await this.channel.prefetch(1);

        this.channel.consume(q, async (msg) => {
          if (!msg) return;
          try {
            const event = JSON.parse(msg.content.toString());
            const routingKey = msg.fields.routingKey;
            console.log(`[NotificationConsumer] Consumed ${routingKey}: ${event.eventId}`);
            const payload = event.payload;

            if (routingKey === RABBITMQ_CONFIG.ROUTING_KEYS.REQUEST_APPROVED) {
              try {
                const mailRes = await sendApprovalEmail(
                  payload,
                  process.env.GATEWAY_PUBLIC_URL || 'http://localhost:8000'
                );
                notificationStore.record({
                  type: 'APPROVAL_EMAIL',
                  requestId: payload.requestId,
                  requestNumber: payload.requestNumber,
                  recipient: payload.student.email,
                  studentName: payload.student.fullName,
                  status: 'SENT',
                  messageId: mailRes.messageId
                });
              } catch (mailErr) {
                console.error('[NotificationConsumer] Failed to send approval email:', mailErr.message);
                notificationStore.record({
                  type: 'APPROVAL_EMAIL',
                  requestId: payload.requestId,
                  requestNumber: payload.requestNumber,
                  recipient: payload.student.email,
                  status: 'FAILED',
                  error: mailErr.message
                });
              }
            } else if (routingKey === RABBITMQ_CONFIG.ROUTING_KEYS.REQUEST_REJECTED) {
              try {
                const mailRes = await sendRejectionEmail(payload);
                notificationStore.record({
                  type: 'REJECTION_EMAIL',
                  requestId: payload.requestId,
                  requestNumber: payload.requestNumber,
                  recipient: payload.student.email,
                  studentName: payload.student.fullName,
                  status: 'SENT',
                  messageId: mailRes.messageId
                });
              } catch (mailErr) {
                console.error('[NotificationConsumer] Failed to send rejection email:', mailErr.message);
                notificationStore.record({
                  type: 'REJECTION_EMAIL',
                  requestId: payload.requestId,
                  requestNumber: payload.requestNumber,
                  recipient: payload.student.email,
                  status: 'FAILED',
                  error: mailErr.message
                });
              }
            }

            this.channel.ack(msg);
          } catch (procErr) {
            console.error('[NotificationConsumer] Error processing message:', procErr.message);
            this.channel.nack(msg, false, false);
          }
        });

        this.isListening = true;
        console.log(`[NotificationService] Consumer registered on queue "${q}"`);

        this.connection.on('error', (err) => {
          console.error('[NotificationService] RabbitMQ Connection error:', err.message);
          this.isListening = false;
        });

        this.connection.on('close', () => {
          console.warn('[NotificationService] RabbitMQ Connection closed. Retrying in 5s...');
          this.isListening = false;
          setTimeout(() => this.start(), 5000);
        });

        return;
      } catch (err) {
        console.warn(`[NotificationService] RabbitMQ attempt ${attempt} failed: ${err.message}`);
        if (attempt === retries) {
          console.warn('[NotificationService] RabbitMQ not reachable yet. Will retry in 10s.');
          setTimeout(() => this.start(), 10000);
          return;
        }
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
}

export const notificationConsumer = new NotificationConsumer();
