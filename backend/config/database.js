import mongoose from 'mongoose';
import logger from '../utils/logger.js';

/**
 * Initialize MongoDB connection
 * Implements connection pooling and error handling
 */
export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Close database connection gracefully
 */
export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  } catch (error) {
    logger.error(`MongoDB disconnect error: ${error.message}`);
  }
};

/**
 * Health check for database
 */
export const checkDBHealth = async () => {
  try {
    const admin = mongoose.connection.db.admin();
    await admin.ping();
    return { status: 'healthy', database: 'MongoDB' };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
};

export default connectDB;
