import amqp from 'amqplib';
import { RABBITMQ_CONFIG } from './contracts.js';

export class RabbitMQManager {
  constructor(serviceName = 'UnknownService') {
    this.serviceName = serviceName;
    this.connection = null;
    this.channel = null;
    this.url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  }

  async connect(retries = 10, delayMs = 3000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[${this.serviceName}] Connecting to RabbitMQ at ${this.url} (Attempt ${attempt}/${retries})...`);
        this.connection = await amqp.connect(this.url);
        this.channel = await this.connection.createChannel();

        // Declare main topic exchange
        await this.channel.assertExchange(RABBITMQ_CONFIG.EXCHANGE, RABBITMQ_CONFIG.EXCHANGE_TYPE, {
          durable: true
        });

        console.log(`[${this.serviceName}] Successfully connected to RabbitMQ and declared exchange "${RABBITMQ_CONFIG.EXCHANGE}"`);

        this.connection.on('error', (err) => {
          console.error(`[${this.serviceName}] RabbitMQ Connection Error:`, err.message);
        });

        this.connection.on('close', () => {
          console.warn(`[${this.serviceName}] RabbitMQ Connection closed. Will attempt reconnect on next call.`);
          this.connection = null;
          this.channel = null;
        });

        return this.channel;
      } catch (err) {
        console.warn(`[${this.serviceName}] Connection attempt ${attempt} failed: ${err.message}`);
        if (attempt === retries) {
          throw new Error(`[${this.serviceName}] Could not connect to RabbitMQ after ${retries} attempts.`);
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async publish(routingKey, message) {
    if (!this.channel) {
      await this.connect();
    }
    const payloadBuffer = Buffer.from(JSON.stringify(message));
    this.channel.publish(RABBITMQ_CONFIG.EXCHANGE, routingKey, payloadBuffer, {
      persistent: true,
      contentType: 'application/json',
      timestamp: Date.now()
    });
    console.log(`[${this.serviceName}] Published event to "${routingKey}":`, message.eventId || '');
  }

  async consume(queueName, routingKeys, onMessage) {
    if (!this.channel) {
      await this.connect();
    }

    // Assert queue with durable flag
    await this.channel.assertQueue(queueName, { durable: true });

    // Bind queue to all requested routing keys
    const keys = Array.isArray(routingKeys) ? routingKeys : [routingKeys];
    for (const key of keys) {
      await this.channel.bindQueue(queueName, RABBITMQ_CONFIG.EXCHANGE, key);
      console.log(`[${this.serviceName}] Bound queue "${queueName}" to key "${key}"`);
    }

    // Prefetch for fair dispatch
    await this.channel.prefetch(1);

    this.channel.consume(queueName, async (msg) => {
      if (!msg) return;
      try {
        const content = JSON.parse(msg.content.toString());
        const routingKey = msg.fields.routingKey;
        console.log(`[${this.serviceName}] Received message on "${routingKey}" via queue "${queueName}"`);
        await onMessage(content, routingKey);
        this.channel.ack(msg);
      } catch (err) {
        console.error(`[${this.serviceName}] Error handling message from "${queueName}":`, err.message);
        // Reject and requeue or discard based on error type
        this.channel.nack(msg, false, false);
      }
    });

    console.log(`[${this.serviceName}] Listening on queue "${queueName}"`);
  }

  async close() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch (err) {
      console.error(`[${this.serviceName}] Error closing RabbitMQ connection:`, err.message);
    }
  }
}

