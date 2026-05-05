import express from 'express';
import analyzeController from '../controllers/analyzeController.js';

const router = express.Router();

/**
 * POST /api/tab
 * Sync a single tab
 */
router.post('/', analyzeController.tabSync);

/**
 * POST /api/tab/batch
 * Sync multiple tabs at once
 */
router.post('/batch', analyzeController.tabSyncBatch);

export default router;