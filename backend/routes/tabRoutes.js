import express from 'express';
import { tabSync } from '../controllers/analyzeController.js';

const router = express.Router();

router.post('/', tabSync);

export default router;
