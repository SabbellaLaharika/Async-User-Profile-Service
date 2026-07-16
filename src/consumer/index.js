const pool = require('../database');
const mqService = require('../services/MessageQueueService');
const profileUpdateService = require('../services/ProfileUpdateService');

async function startConsumer() {
  try {
    // 1. Verify Database connectivity
    const connection = await pool.getConnection();
    console.log('[Consumer] Connected to MySQL database pool.');
    connection.release();

    // 2. Connect to RabbitMQ
    await mqService.connect();
    console.log('[Consumer] Connected to RabbitMQ. Listening for messages...');

    // 3. Start consuming from the queue
    await mqService.consume('profile_update_queue', async (message) => {
      const { userId, newEmail, newPreferences } = message;
      console.log(`[Consumer] Processing update message for userId: ${userId}`);

      if (!userId) {
        console.error('[Consumer] Received message missing userId. Discarding...');
        return; // return successfully to ack and discard the invalid message
      }

      try {
        await profileUpdateService.processUpdate(userId, { newEmail, newPreferences });
        console.log(`[Consumer] Successfully updated profile for user ID: ${userId}`);
      } catch (err) {
        console.error(`[Consumer] Error updating profile for user ID ${userId}: ${err.message}`);
        // Re-throw so that the MQ service nacks the message, or we handle it here
        throw err;
      }
    });

  } catch (error) {
    console.error('[Consumer] Fatal error during consumer startup:', error);
    process.exit(1);
  }
}

// Clean shutdown handlers
const shutdown = async (signal) => {
  console.log(`[Consumer] Received ${signal}. Shutting down worker...`);
  try {
    await mqService.close();
    await pool.end();
    console.log('[Consumer] Worker shutdown completed.');
    process.exit(0);
  } catch (err) {
    console.error('[Consumer] Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startConsumer();
