import express from "express";

import * as analyzeController from "../controllers/analyzeController.js";
import { authenticate } from "../middleware/auth.js";
import { checkApiKey } from "../middleware/apiKeyMiddleware.js";
import {
  validate,
  trafficAnalysisSchema,
  batchAnalysisSchema,
} from "../utils/validators.js";
import { createRateLimiter } from "../config/security.js";

const router = express.Router();

const analysisLimiter = createRateLimiter(60 * 1000, 50);

/* =========================
   Auth helper: JWT or API Key
========================= */
const requireAuthOrApiKey = (req, res, next) => {
  if (req.headers["x-api-key"]) {
    return checkApiKey(req, res, next);
  }

  return authenticate(req, res, next);
};

/* =========================
   Analyze Routes
========================= */

// Analyze single traffic packet
router.post(
  "/",
  requireAuthOrApiKey,
  analysisLimiter,
  validate(trafficAnalysisSchema),
  analyzeController.analyzeTraffic
);

// Batch analysis
router.post(
  "/batch",
  requireAuthOrApiKey,
  analysisLimiter,
  validate(batchAnalysisSchema),
  analyzeController.analyzeTrafficBatch
);

// Tab title synchronization from browser extension
router.post(
  "/tab",
  analysisLimiter,
  analyzeController.tabSync
);

// Get statistics
router.get(
  "/statistics",
  authenticate,
  analyzeController.getStatistics
);

// Get severity timeline
router.get(
  "/severity-timeline",
  authenticate,
  analyzeController.getSeverityTimeline
);

export default router;