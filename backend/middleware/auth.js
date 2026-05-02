import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { logSecurityEvent } from '../utils/logger.js';

/**
 * Verify JWT token from Authorization header
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', {
        ip: req.ip,
        path: req.path,
        reason: 'Missing or invalid Authorization header',
      });

      return res.status(401).json({
        success: false,
        message: 'No authorization token provided',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found',
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'User account is inactive',
        });
      }

      // Attach user to request
      req.user = user;
      req.token = token;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired',
          expiredAt: error.expiredAt,
        });
      }

      logSecurityEvent('INVALID_TOKEN_ATTEMPT', {
        ip: req.ip,
        path: req.path,
        error: error.message,
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid or malformed token',
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message,
    });
  }
};

/**
 * Authorize based on user role
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logSecurityEvent('UNAUTHORIZED_ROLE_ACCESS', {
        userId: req.user._id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
      });

      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
    }

    next();
  };
};

/**
 * Verify JWT token (for token refresh, optional auth)
 */
export const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { valid: true, decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

/**
 * Generate JWT token
 */
export const generateToken = (userId, expiresIn = process.env.JWT_EXPIRATION) => {
  return jwt.sign(
    {
      userId: userId.toString(),
      iat: Math.floor(Date.now() / 1000),
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

/**
 * Decode JWT token without verification (for debugging)
 */
export const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

/**
 * Optional authentication (doesn't fail, just attaches user if available)
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (user && user.isActive) {
        req.user = user;
        req.token = token;
      }
    }
  } catch (error) {
    // Silently fail - this is optional auth
  }

  next();
};

export default {
  authenticate,
  authorize,
  verifyToken,
  generateToken,
  decodeToken,
  optionalAuth,
};
