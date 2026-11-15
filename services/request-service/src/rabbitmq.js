import amqp from 'amqplib';
import { RABBITMQ_CONFIG } from '../../../shared/contracts.js';
import { buildRequestApprovedEvent, buildRequestRejectedEvent } from '../../../shared/eventSchemas.js';

class RequestEventPublisher {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
    this.url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  }

  async init(retries = 10, delayMs = 3000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[RequestService] Connecting to RabbitMQ at ${this.url} (Attempt ${attempt}/${retries})...`);
        this.connection = await amqp.connect(this.url);
        this.channel = await this.connection.createChannel();

        await this.channel.assertExchange(RABBITMQ_CONFIG.EXCHANGE, RABBITMQ_CONFIG.EXCHANGE_TYPE, {
          durable: true
        });

        this.isConnected = true;
        console.log(`[RequestService] Connected to RabbitMQ and declared exchange "${RABBITMQ_CONFIG.EXCHANGE}"`);

        this.connection.on('error', (err) => {
          console.error('[RequestService] RabbitMQ Connection error:', err.message);
          this.isConnected = false;
        });

        this.connection.on('close', () => {
          console.warn('[RequestService] RabbitMQ Connection closed.');
          this.isConnected = false;
          this.channel = null;
          this.connection = null;
        });

        return this.channel;
      } catch (err) {
        console.warn(`[RequestService] RabbitMQ connection attempt ${attempt} failed: ${err.message}`);
        if (attempt === retries) {
          console.warn('[RequestService] RabbitMQ not reachable currently. Will retry on publish.');
          return null;
        }
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  async publish(routingKey, message) {
    if (!this.channel) {
      await this.init(3, 1000);
    }
    if (!this.channel) {
      throw new Error('RabbitMQ channel unavailable');
    }

    const payloadBuffer = Buffer.from(JSON.stringify(message));
    this.channel.publish(RABBITMQ_CONFIG.EXCHANGE, routingKey, payloadBuffer, {
      persistent: true,
      contentType: 'application/json',
      timestamp: Date.now()
    });
    console.log(`[RequestService] Published event to "${routingKey}": ${message.eventId}`);
  }

  async publishApproval(request, student) {
    const event = buildRequestApprovedEvent({ request, student });
    await this.publish(RABBITMQ_CONFIG.ROUTING_KEYS.REQUEST_APPROVED, event);
    return event;
  }

  async publishRejection(request, student) {
    const event = buildRequestRejectedEvent({ request, student });
    await this.publish(RABBITMQ_CONFIG.ROUTING_KEYS.REQUEST_REJECTED, event);
    return event;
  }
}

export const requestPublisher = new RequestEventPublisher();
