const app = require('./app');
const pool = require('../database');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Validate database connectivity on startup
    const connection = await pool.getConnection();
    console.log('Database connection established successfully.');
    connection.release();

    app.listen(PORT, () => {
      console.log(`API Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
    });
  } catch (err) {
    console.error('Database connection failed. Exiting server...', err);
    process.exit(1);
  }
}

startServer();
