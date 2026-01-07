require('dotenv').config();
const mongoose = require('mongoose');
const { app, PORT } = require('./src/app');

// 1. Start Server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// 2. Graceful Shutdown Logic
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Closing server...`);
  
  try {
    // Stop accepting new requests
    server.close(() => {
      console.log('HTTP server closed.');
    });

    // Close DB Connection
    await mongoose.connection.close(false);
    console.log('MongoDB connection closed.');
    
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

// 3. Listen for Termination Signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 4. Handle Uncaught Errors (Prevent zombie processes)
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});