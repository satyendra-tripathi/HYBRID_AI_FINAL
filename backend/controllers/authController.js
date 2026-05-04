import User from "../models/User.js";
import { generateToken } from "../middleware/auth.js";
import {
  asyncHandler,
  ConflictError,
  AuthenticationError,
  AppError,
} from "../middleware/errorHandler.js";
import logger from "../utils/logger.js";
import { isValidEmail, isValidPassword } from "../config/security.js";

const normalizeEmail = (email = "") => email.trim().toLowerCase();

const buildAuthResponse = (user, token) => ({
  user: user.getPublicProfile(),
  token,
  expiresIn: process.env.JWT_EXPIRATION || "7d",
});

/**
 * Register new user
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req, res) => {
  const { name, password } = req.validatedData;
  const email = normalizeEmail(req.validatedData.email);

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ConflictError("Email already registered");
  }

  const user = new User({
    name: name.trim(),
    email,
    password,
    role: "user",
    isActive: true,
  });

  await user.save();

  logger.info(`New user registered: ${email}`);

  const token = generateToken(user._id);

  return res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: buildAuthResponse(user, token),
  });
});

/**
 * Login user
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.validatedData.email);
  const { password } = req.validatedData;

  const user = await User.findOne({ email }).select(
    "+password +loginAttempts +lockUntil"
  );

  if (!user) {
    logger.warn(`Login attempt with non-existent email: ${email}`);
    throw new AuthenticationError("Invalid credentials");
  }

  if (typeof user.isAccountLocked === "function" && user.isAccountLocked()) {
    logger.warn(`Login attempt on locked account: ${email}`);
    throw new AuthenticationError(
      "Account is locked due to multiple failed login attempts. Try again later."
    );
  }

  if (!user.isActive) {
    throw new AuthenticationError("User account is inactive");
  }

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    if (typeof user.recordFailedLogin === "function") {
      await user.recordFailedLogin();
    }

    logger.warn(`Failed login attempt for user: ${email}`);
    throw new AuthenticationError("Invalid credentials");
  }

  if (typeof user.resetLoginAttempts === "function") {
    await user.resetLoginAttempts();
  }

  user.metadata = {
    ...(user.metadata || {}),
    lastIP: req.ip,
    userAgent: req.get("user-agent"),
    loginCount: (user.metadata?.loginCount || 0) + 1,
  };

  await user.save();

  logger.info(`User logged in: ${email}`);

  const token = generateToken(user._id);

  return res.status(200).json({
    success: true,
    message: "Login successful",
    data: buildAuthResponse(user, token),
  });
});

/**
 * Get current user profile
 * GET /api/auth/me
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "User profile retrieved",
    data: {
      user: req.user.getPublicProfile(),
    },
  });
});

/**
 * Update user profile
 * PUT /api/auth/profile
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, currentPassword, newPassword } = req.validatedData;

  const user = await User.findById(req.user._id).select("+password");

  if (!user) {
    throw new AuthenticationError("User not found");
  }

  if (name) {
    user.name = name.trim();
  }

  if (newPassword) {
    if (!currentPassword) {
      throw new AuthenticationError("Current password is required");
    }

    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      throw new AuthenticationError("Current password is incorrect");
    }

    user.password = newPassword;
    logger.info(`Password changed for user: ${user.email}`);
  }

  await user.save();

  return res.status(200).json({
    success: true,
    message: "Profile updated successfully",
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

  user.preferences = user.preferences || {};

  if (typeof emailNotifications === "boolean") {
    user.preferences.emailNotifications = emailNotifications;
  }

  if (typeof alertsOnHighSeverity === "boolean") {
    user.preferences.alertsOnHighSeverity = alertsOnHighSeverity;
  }

  if (theme !== undefined) {
    const allowedThemes = ["light", "dark", "system"];

    if (!allowedThemes.includes(theme)) {
      throw new AppError("Invalid theme value", 400);
    }

    user.preferences.theme = theme;
  }

  await user.save();

  return res.status(200).json({
    success: true,
    message: "Preferences updated",
    data: {
      preferences: user.preferences,
    },
  });
});

/**
 * Forgot password
 * POST /api/auth/forgot-password
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!email || !isValidEmail(email)) {
    throw new AppError("Valid email is required", 400);
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(200).json({
      success: true,
      message: "If email exists, reset link will be sent",
    });
  }

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  logger.info(`Password reset requested for: ${email}`);

  return res.status(200).json({
    success: true,
    message: "If email exists, reset link will be sent",
    ...(process.env.NODE_ENV === "development" && { resetToken }),
  });
});

/**
 * Reset password
 * POST /api/auth/reset-password
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { token, newPassword } = req.body;

  if (!email || !token || !newPassword) {
    throw new AppError("Email, token and new password are required", 400);
  }

  if (!isValidEmail(email)) {
    throw new AppError("Invalid email", 400);
  }

  if (!isValidPassword(newPassword)) {
    throw new AppError(
      "Password must contain uppercase, lowercase, number and special character",
      400
    );
  }

  const user = await User.findOne({ email }).select(
    "+passwordResetToken +passwordResetExpires"
  );

  if (
    !user ||
    typeof user.verifyPasswordResetToken !== "function" ||
    !user.verifyPasswordResetToken(token)
  ) {
    throw new AuthenticationError("Invalid or expired reset token");
  }

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  logger.info(`Password reset completed for: ${email}`);

  return res.status(200).json({
    success: true,
    message: "Password reset successfully",
  });
});

/**
 * Logout
 * POST /api/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
  logger.info(`User logged out: ${req.user?.email || "unknown"}`);

  return res.status(200).json({
    success: true,
    message: "Logout successful",
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