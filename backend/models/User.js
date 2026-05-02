import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { SECURITY_CONFIG } from '../config/security.js';

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email',
      ],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false, // Don't include password by default
    },

    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationToken: {
      type: String,
      select: false,
    },

    passwordResetToken: {
      type: String,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
    },

    lastLogin: {
      type: Date,
      default: null,
    },

    loginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    lockUntil: {
      type: Date,
      select: false,
    },

    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },

    twoFactorSecret: {
      type: String,
      select: false,
    },

    lastActivity: {
      type: Date,
      default: Date.now,
    },

    preferences: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      alertsOnHighSeverity: {
        type: Boolean,
        default: true,
      },
      theme: {
        type: String,
        enum: ['light', 'dark'],
        default: 'dark',
      },
    },

    metadata: {
      lastIP: String,
      userAgent: String,
      loginCount: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Hash password before saving
 */
UserSchema.pre('save', async function (next) {
  // Only hash if password is modified
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(SECURITY_CONFIG.BCRYPT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Compare password with hashed password
 */
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Get public user data
 */
UserSchema.methods.getPublicProfile = function () {
  const user = this.toObject();
  delete user.password;
  delete user.emailVerificationToken;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  delete user.loginAttempts;
  delete user.lockUntil;
  delete user.twoFactorSecret;
  return user;
};

/**
 * Check if account is locked
 */
UserSchema.methods.isAccountLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

/**
 * Record failed login attempt
 */
UserSchema.methods.recordFailedLogin = async function () {
  if (!this.isAccountLocked()) {
    // Reset attempts if lock has expired
    if (this.lockUntil < Date.now()) {
      this.loginAttempts = 1;
      this.lockUntil = undefined;
    } else {
      this.loginAttempts += 1;
    }
  }

  // Lock account after 5 failed attempts
  if (this.loginAttempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
    this.lockUntil = new Date(Date.now() + SECURITY_CONFIG.LOCK_TIME);
  }

  return this.save();
};

/**
 * Reset login attempts after successful login
 */
UserSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  this.lastLogin = new Date();
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Create password reset token
 */
UserSchema.methods.createPasswordResetToken = function () {
  const resetToken = Math.random().toString(36).substring(2, 15) +
                    Math.random().toString(36).substring(2, 15);
  
  this.passwordResetToken = resetToken;
  this.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  
  return resetToken;
};

/**
 * Verify password reset token
 */
UserSchema.methods.verifyPasswordResetToken = function (token) {
  return (
    this.passwordResetToken === token &&
    this.passwordResetExpires > Date.now()
  );
};

/**
 * Middleware to update lastActivity
 */
UserSchema.pre('save', function (next) {
  this.lastActivity = new Date();
  next();
});

/**
 * Index for faster queries
 */
UserSchema.index({ createdAt: -1 });
UserSchema.index({ lastActivity: -1 });

const User = mongoose.model('User', UserSchema);

export default User;
