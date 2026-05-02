import express from 'express';
import * as logsController from '../controllers/logsController.js';
import { authenticate } from '../middleware/auth.js';
import { validateQuery } from '../utils/validators.js';
import { searchLogsSchema } from '../utils/validators.js';

const router = express.Router();

/**
 * Protected routes (authentication required)
 */

// Get all logs with pagination
router.get(
  '/',
  authenticate,
  validateQuery(searchLogsSchema),
  logsController.getLogs
);

// Search logs
router.get(
  '/search',
  authenticate,
  validateQuery(searchLogsSchema),
  logsController.searchLogs
);

// Get log statistics
router.get('/stats', authenticate, logsController.getLogStats);

// Export logs as CSV
router.get('/export/csv', authenticate, logsController.exportLogsCSV);

// Get single log by ID
router.get('/:id', authenticate, logsController.getLogById);

// Update log status
router.patch('/:id/status', authenticate, logsController.updateLogStatus);

// Kill attack
router.post('/:id/kill', authenticate, logsController.killLogAttack);

// Delete log
router.delete('/:id', authenticate, logsController.deleteLog);

export default router;
