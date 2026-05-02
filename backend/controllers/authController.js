import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';
import { asyncHandler, ConflictError, AuthenticationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Register new user
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.validatedData;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ConflictError('Email already registered');
  }

  // Create new user
  const user = new User({
    name,
    email,
    password,
    role: 'user',
    isActive: true,
  });

  // Save user (password will be hashed by pre-save middleware)
  await user.save();

  logger.info(`New user registered: ${email}`);

  // Generate JWT token
  const token = generateToken(user._id);

  // Get public profile
  const userProfile = user.getPublicProfile();

  return res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: userProfile,
      token,
      expiresIn: process.env.JWT_EXPIRATION,
    },
  });
});

/**
 * Login user
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validatedData;

  // Find user by email and select password
  const user = await User.findOne({ email }).select('+password +loginAttempts +lockUntil');

  if (!user) {
    logger.warn(`Login attempt with non-existent email: ${email}`);
    throw new AuthenticationError('Invalid credentials');
  }

  // Check if account is locked
  if (user.isAccountLocked()) {
    logger.warn(`Login attempt on locked account: ${email}`);
    throw new AuthenticationError(
      'Account is locked due to multiple failed login attempts. Try again later.'
    );
  }

  // Check if user is active
  if (!user.isActive) {
    throw new AuthenticationError('User account is inactive');
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    await user.recordFailedLogin();
    logger.warn(`Failed login attempt for user: ${email}`);
    throw new AuthenticationError('Invalid credentials');
  }

  // Reset login attempts on successful login
  await user.resetLoginAttempts();

  // Update metadata
  user.metadata = {
    lastIP: req.ip,
    userAgent: req.get('user-agent'),
    loginCount: (user.metadata?.loginCount || 0) + 1,
  };
  await user.save();

  logger.info(`User logged in: ${email}`);

  // Generate JWT token
  const token = generateToken(user._id);

  // Get public profile
  const userProfile = user.getPublicProfile();

  return res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: userProfile,
      token,
      expiresIn: process.env.JWT_EXPIRATION,
    },
  });
});

/**
 * Get current user profile
 * GET /api/auth/me
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = req.user;

  return res.status(200).json({
    success: true,
    message: 'User profile retrieved',
    data: {
      user: user.getPublicProfile(),
    },
  });
});

/**
 * Update user profile
 * PUT /api/auth/profile
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, currentPassword, newPassword } = req.validatedData;
  const user = await User.findById(req.user._id).select('+password');

  // Update name if provided
  if (name) {
    user.name = name;
  }

  // Update password if provided
  if (newPassword) {
    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    user.password = newPassword;
    logger.info(`Password changed for user: ${user.email}`);
  }

  await user.save();

  return res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: user.getPublicProfile(),
    },
  });
});

/**
 * Update user preferences
 * PATCH /api/auth/preferences
 */
export const updatePreferences = asyncHandler(async (req, res) => {
  const { emailNotifications, alertsOnHighSeverity, theme } = req.body;
  const user = req.user;

  if (emailNotifications !== undefined) {
    user.preferences.emailNotifications = emailNotifications;
  }
  if (alertsOnHighSeverity !== undefined) {
    user.preferences.alertsOnHighSeverity = alertsOnHighSeverity;
  }
  if (theme !== undefined) {
    user.preferences.theme = theme;
  }

  await user.save();

  return res.status(200).json({
    success: true,
    message: 'Preferences updated',
    data: {
      preferences: user.preferences,
    },
  });
});

/**
 * Request password reset
 * POST /api/auth/forgot-password
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    // Don't reveal if user exists for security
    return res.status(200).json({
      success: true,
      message: 'If email exists, reset link will be sent',
    });
  }

  // Create reset token
  const resetToken = user.createPasswordResetToken();
  await user.save();

  logger.info(`Password reset requested for: ${email}`);

  // In production, send email with reset link
  // For now, return token for testing
  return res.status(200).json({
    success: true,
    message: 'Password reset link sent to email',
    ...(process.env.NODE_ENV === 'development' && { resetToken }),
  });
});

/**
 * Reset password
 * POST /api/auth/reset-password
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, token, newPassword } = req.body;

  const user = await User.findOne({ email }).select('+passwordResetToken +passwordResetExpires');

  if (!user || !user.verifyPasswordResetToken(token)) {
    throw new AuthenticationError('Invalid or expired reset token');
  }

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  logger.info(`Password reset completed for: ${email}`);

  return res.status(200).json({
    success: true,
    message: 'Password reset successfully',
  });
});

/**
 * Logout (revoke token on client side)
 * POST /api/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
  logger.info(`User logged out: ${req.user.email}`);

  return res.status(200).json({
    success: true,
    message: 'Logout successful',
  });
});

export default {
  register,
  login,
  getCurrentUser,
  updateProfile,
  updatePreferences,
  forgotPassword,
  resetPassword,
  logout,
};
