import Joi from 'joi';
import { isValidEmail, isValidPassword } from '../config/security.js';

/**
 * User registration validation schema
 */
export const registerSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name must not exceed 50 characters',
    }),

  email: Joi.string()
    .email()
    .lowercase()
    .required()
    .external(async (value) => {
      if (!isValidEmail(value)) {
        throw new Error('Invalid email format');
      }
    })
    .messages({
      'string.email': 'Invalid email format',
      'string.empty': 'Email is required',
    }),

  password: Joi.string()
    .min(8)
    .max(128)
    .required()
    .external(async (value) => {
      if (!isValidPassword(value)) {
        throw new Error(
          'Password must contain uppercase, lowercase, number, and special character'
        );
      }
    })
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.max': 'Password must not exceed 128 characters',
      'string.empty': 'Password is required',
    }),

  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Passwords do not match',
    }),
});

/**
 * User login validation schema
 */
export const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .required()
    .messages({
      'string.email': 'Invalid email format',
      'string.empty': 'Email is required',
    }),

  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Password is required',
    }),
});

/**
 * Traffic analysis validation schema
 */
export const trafficAnalysisSchema = Joi.object({
  protocol: Joi.string()
    .valid('TCP', 'UDP', 'ICMP', 'HTTP', 'HTTPS')
    .required()
    .messages({
      'any.only': 'Invalid protocol',
    }),

  src_port: Joi.number()
    .min(1)
    .max(65535)
    .required()
    .messages({
      'number.min': 'Source port must be between 1 and 65535',
      'number.max': 'Source port must be between 1 and 65535',
    }),

  dst_port: Joi.number()
    .min(1)
    .max(65535)
    .required()
    .messages({
      'number.min': 'Destination port must be between 1 and 65535',
      'number.max': 'Destination port must be between 1 and 65535',
    }),

  duration: Joi.number()
    .min(0)
    .max(3600000) // Max 1 hour
    .required()
    .messages({
      'number.min': 'Duration must be non-negative',
      'number.max': 'Duration must not exceed 1 hour',
    }),

  bytes_sent: Joi.number()
    .min(0)
    .required()
    .messages({
      'number.min': 'Bytes sent must be non-negative',
    }),

  bytes_received: Joi.number()
    .min(0)
    .required()
    .messages({
      'number.min': 'Bytes received must be non-negative',
    }),

  // Optional fields
  src_ip: Joi.string().ip().optional(),
  dst_ip: Joi.string().ip().optional(),
  flags: Joi.number().optional(),
});

/**
 * Search logs validation schema
 */
export const searchLogsSchema = Joi.object({
  page: Joi.number()
    .min(1)
    .default(1)
    .messages({
      'number.min': 'Page must be at least 1',
    }),

  limit: Joi.number()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit must not exceed 100',
    }),

  attackType: Joi.string()
    .valid('All', 'Normal', 'DDoS', 'Port Scan', 'Brute Force', 'Malware')
    .default('All')
    .optional(),

  severity: Joi.string()
    .valid('All', 'Low', 'Medium', 'High', 'Critical')
    .default('All')
    .optional(),

  dateFrom: Joi.date().optional(),
  dateTo: Joi.date().optional(),
});

/**
 * Update profile validation schema
 */
export const updateProfileSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .optional(),

  currentPassword: Joi.string()
    .when('newPassword', {
      is: Joi.exist(),
      then: Joi.required(),
    })
    .messages({
      'string.empty': 'Current password is required',
    }),

  newPassword: Joi.string()
    .min(8)
    .max(128)
    .optional()
    .external(async (value) => {
      if (value && !isValidPassword(value)) {
        throw new Error(
          'New password must contain uppercase, lowercase, number, and special character'
        );
      }
    }),

  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .when('newPassword', {
      is: Joi.exist(),
      then: Joi.required(),
    })
    .messages({
      'any.only': 'Passwords do not match',
    }),
});

/**
 * Validate request data
 */
export const validate = (schema) => {
  return async (req, res, next) => {
    try {
      const value = await schema.validateAsync(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });
      req.validatedData = value;
      next();
    } catch (error) {
      const messages = error.details
        ? error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          }))
        : [{ field: 'unknown', message: error.message }];

      return res.status(400).json({
        success: false,
        message: error.details ? 'Validation failed' : error.message,
        errors: messages,
      });
    }
  };
};

/**
 * Validate query parameters
 */
export const validateQuery = (schema) => {
  return async (req, res, next) => {
    try {
      const value = await schema.validateAsync(req.query, {
        abortEarly: false,
        stripUnknown: true,
      });
      req.validatedQuery = value;
      next();
    } catch (error) {
      const messages = error.details
        ? error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          }))
        : [{ field: 'unknown', message: error.message }];

      return res.status(400).json({
        success: false,
        message: error.details ? 'Invalid query parameters' : error.message,
        errors: messages,
      });
    }
  };
};

export default {
  registerSchema,
  loginSchema,
  trafficAnalysisSchema,
  searchLogsSchema,
  updateProfileSchema,
  validate,
  validateQuery,
};
