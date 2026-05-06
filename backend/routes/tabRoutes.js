import express from 'express';
import analyzeController from '../controllers/analyzeController.js';
import { checkApiKey } from '../middleware/apiKeyMiddleware.js';

const router = express.Router();
const apiKeyMiddleware = process.env.API_KEY ? checkApiKey : (req, res, next) => next();

/**
 * POST /api/tab
 * Sync a single tab
 */
router.post('/', apiKeyMiddleware, analyzeController.tabSync);

/**
 * POST /api/tab/batch
 * Sync multiple tabs at once
 */
router.post('/batch', apiKeyMiddleware, analyzeController.tabSyncBatch);

export default router;