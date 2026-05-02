import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

/**
 * Configure helmet for security headers
 * - Protects against XSS, clickjacking, MIME type sniffing
 */
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", process.env.CORS_ORIGIN || 'http://localhost:3000'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

/**
 * Configure CORS for frontend access
 */
export const corsConfig = cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  credentials: false,
});

/**
 * General rate limiter for API endpoints
 * 100 requests per 15 minutes per IP
 */
export const createRateLimiter = (windowMs = 15 * 60 * 1000, maxRequests = 100) => {
  // In development, use very relaxed limits
  const isDev = process.env.NODE_ENV === 'development';
  return rateLimit({
    windowMs: isDev ? 60 * 1000 : windowMs,       // 1 min window in dev
    max: isDev ? 1000 : maxRequests,              // 1000 req/min in dev
    message: { success: false, message: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks and internal API key requests
      return req.path === '/health' || !!req.headers['x-api-key'];
    },
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise use IP
      return req.user?._id?.toString() || req.ip;
    },
  });
};

/**
 * Strict rate limiter for authentication endpoints
 * 5 attempts per 15 minutes
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 50 : 5,  // 50 in dev, 5 in prod
  message: { success: false, message: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.email || req.ip,
});

/**
 * Security constants
 */
export const SECURITY_CONFIG = {
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  JWT_EXPIRATION: process.env.JWT_EXPIRATION || '7d',
  SESSION_TIMEOUT: 60 * 60 * 1000, // 1 hour
  MAX_LOGIN_ATTEMPTS: 5,
  LOCK_TIME: 15 * 60 * 1000, // 15 minutes
};

/**
 * Sanitize MongoDB queries to prevent NoSQL injection
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove MongoDB operators
  return input
    .replace(/[\$\{\}]/g, '')
    .trim()
    .substring(0, 1000); // Limit length
};

/**
 * Validate email format
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

/**
 * Validate password strength
 */
export const isValidPassword = (password) => {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) && // Uppercase
    /[a-z]/.test(password) && // Lowercase
    /[0-9]/.test(password) && // Number
    /[!@#$%^&*]/.test(password) // Special char
  );
};

/**
 * Generate secure random token
 */
export const generateSecureToken = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

export default {
  helmetConfig,
  corsConfig,
  createRateLimiter,
  authRateLimiter,
  SECURITY_CONFIG,
  sanitizeInput,
  isValidEmail,
  isValidPassword,
  generateSecureToken,
};
