const amqp = require('amqplib');

class MessageQueueService {
  constructor(url) {
    this.url = url || process.env.RABBITMQ_URL || 'amqp://localhost';
    this.connection = null;
    this.channel = null;
  }

  async connect() {
    const maxRetries = 10;
    const retryInterval = 5000; // 5 seconds

    for (let i = 1; i <= maxRetries; i++) {
      try {
        this.connection = await amqp.connect(this.url);
        this.channel = await this.connection.createChannel();
        // Assert the durable queue
        await this.channel.assertQueue('profile_update_queue', { durable: true });
        console.log('Connected to RabbitMQ and asserted profile_update_queue.');
        return;
      } catch (err) {
        console.error(`RabbitMQ connection attempt ${i}/${maxRetries} failed: ${err.message}`);
        if (i === maxRetries) {
          throw new Error(`Failed to connect to RabbitMQ after ${maxRetries} attempts.`);
        }
        await new Promise(resolve => setTimeout(resolve, retryInterval));
      }
    }
  }

  // Publishes a JSON payload to a specific queue
  async publish(queueName, message) {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized. Call connect() first.');
    }
    const buffer = Buffer.from(JSON.stringify(message));
    return this.channel.sendToQueue(queueName, buffer, {
      persistent: true // Ensure message durability
    });
  }

  // Consumes messages from a specific queue
  async consume(queueName, callback) {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized. Call connect() first.');
    }
    // Prefetch 1 to distribute load evenly among consumers
    await this.channel.prefetch(1);

    await this.channel.consume(queueName, async (msg) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString());
        // Delegate processing to the callback
        await callback(content);
        // Acknowledge upon successful processing
        this.channel.ack(msg);
      } catch (err) {
        console.error(`Error processing message from queue ${queueName}:`, err);
        // Requeue parameter: we log and discard poison messages to avoid infinite loops,
        // or nack without requeue. If we decide not to requeue:
        this.channel.nack(msg, false, false); 
      }
    });
  }

  async close() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch (err) {
      console.error('Error closing RabbitMQ connection:', err);
    }
  }
}

// Export a singleton instance initialized with the environment URL
const mqService = new MessageQueueService(process.env.RABBITMQ_URL);
module.exports = mqService;
