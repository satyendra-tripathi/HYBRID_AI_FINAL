import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '../logs');

/**
 * Custom log format
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = JSON.stringify(meta);
    }
    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${metaStr}`;
  })
);

/**
 * Create logger instance
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'ai-ids-backend' },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let metaStr = '';
          if (Object.keys(meta).length > 1) {
            metaStr = JSON.stringify(meta);
          }
          return `[${timestamp}] ${level}: ${message} ${metaStr}`;
        })
      ),
    }),

    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // File transport for errors only
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
  ],
});

/**
 * Log HTTP requests
 */
export const logHttpRequest = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger.log({
      level: logLevel,
      message: `HTTP ${req.method} ${req.originalUrl}`,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?._id?.toString() || 'anonymous',
      userAgent: req.get('user-agent'),
    });
  });

  next();
};

/**
 * Log security events
 */
export const logSecurityEvent = (eventType, details) => {
  logger.warn({
    message: `Security Event: ${eventType}`,
    ...details,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log AI predictions
 */
export const logAIPrediction = (prediction, userId) => {
  if (prediction.isAnomaly || prediction.attack_type !== 'Normal') {
    logger.warn({
      message: 'Suspicious Traffic Detected',
      anomaly: prediction.isAnomaly,
      attackType: prediction.attack_type,
      confidence: prediction.confidence,
      userId,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Log errors with context
 */
export const logError = (error, context = {}) => {
  logger.error({
    message: error.message || 'Unknown error',
    stack: error.stack,
    ...context,
  });
};

export default logger;
