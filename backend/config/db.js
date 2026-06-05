const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority'
    });
    logger.info('MongoDB connected', { host: conn.connection.host, name: conn.connection.name });
    return conn;
  } catch (error) {
    logger.error('MongoDB connection failed', { message: error.message, stack: error.stack });
    process.exit(1);
  }
};

module.exports = connectDB;
