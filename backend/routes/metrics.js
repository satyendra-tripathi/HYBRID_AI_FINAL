import express from 'express';
import * as metricsController from '../controllers/metricsController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get model performance metrics
router.get('/', authenticate, metricsController.getMetrics);

export default router;
