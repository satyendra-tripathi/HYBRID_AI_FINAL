import express from "express";
import { saveTab, saveTabsBatch } from "../controllers/tabController.js";
import { checkApiKey } from "../middleware/apiKeyMiddleware.js";

const router = express.Router();

// Optional API key protection
const apiKeyMiddleware = process.env.API_KEY
  ? checkApiKey
  : (req, res, next) => next();

/**
 * @route   POST /api/tab
 * @desc    Save single browser tab
 */
router.post("/", apiKeyMiddleware, saveTab);

/**
 * @route   POST /api/tab/batch
 * @desc    Save multiple browser tabs
 */
router.post("/batch", apiKeyMiddleware, saveTabsBatch);

export default router;