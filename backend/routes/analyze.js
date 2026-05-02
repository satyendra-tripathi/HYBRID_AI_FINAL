import express from 'express';
import * as analyzeController from '../controllers/analyzeController.js';
import { authenticate } from '../middleware/auth.js';
import { checkApiKey } from '../middleware/apiKeyMiddleware.js';
import { validate } from '../utils/validators.js';
import { trafficAnalysisSchema } from '../utils/validators.js';
import { createRateLimiter } from '../config/security.js';

const router = express.Router();

// Apply rate limiting to analysis endpoints
const analysisLimiter = createRateLimiter(60000, 50); // 50 requests per minute

/**
 * Protected routes (authentication required)
 */

// Custom middleware to allow either JWT or API Key
const requireAuthOrApiKey = (req, res, next) => {
  if (req.headers['x-api-key']) {
    return checkApiKey(req, res, next);
  }
  return authenticate(req, res, next);
};

// Analyze single traffic packet
router.post(
  '/',
  requireAuthOrApiKey,
  analysisLimiter,
  validate(trafficAnalysisSchema),
  analyzeController.analyzeTraffic
);

// Batch analysis
router.post(
  '/batch',
  requireAuthOrApiKey,
  analysisLimiter,
  analyzeController.analyzeTrafficBatch
);

// Tab title synchronization (from browser extension)
router.post(
  '/tab',
  analysisLimiter,
  analyzeController.tabSync
);

// Get statistics
router.get(
  '/statistics',
  authenticate,
  analyzeController.getStatistics
);

// Get severity timeline
router.get(
  '/severity-timeline',
  authenticate,
  analyzeController.getSeverityTimeline
);

export default router;
