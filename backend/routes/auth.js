import express from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../utils/validators.js';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
} from '../utils/validators.js';
import { authRateLimiter } from '../config/security.js';

const router = express.Router();

/**
 * Public routes (no authentication required)
 */

// Register new user
router.post('/register', validate(registerSchema), authController.register);

// Login user
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);

// Forgot password
router.post('/forgot-password', authController.forgotPassword);

// Reset password
router.post('/reset-password', authController.resetPassword);

/**
 * Protected routes (authentication required)
 */

// Get current user
router.get('/me', authenticate, authController.getCurrentUser);

// Update profile
router.put('/profile', authenticate, validate(updateProfileSchema), authController.updateProfile);

// Update preferences
router.patch('/preferences', authenticate, authController.updatePreferences);

// Logout
router.post('/logout', authenticate, authController.logout);

export default router;
