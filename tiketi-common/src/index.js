const { logger } = require('./utils/logger');
const { CustomError } = require('./utils/custom-error');
const {
  CONFIG,
  USER_ROLES,
  EVENT_STATUS,
  SEAT_STATUS,
  RESERVATION_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  LOCK_SETTINGS,
  RESERVATION_SETTINGS,
  CACHE_SETTINGS,
  PAGINATION_DEFAULTS,
  PAYMENT_SETTINGS,
  CACHE_KEYS,
  LOCK_KEYS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} = require('./utils/constants');
const { withTransaction } = require('./utils/transaction-helpers');
const { authenticateToken, requireAdmin } = require('./middleware/auth');
const { errorHandler } = require('./middleware/error-handler');
const db = require('./config/database');

module.exports = {
  // Utils
  logger,
  CustomError,
  withTransaction,
  
  // Constants
  CONFIG,
  USER_ROLES,
  EVENT_STATUS,
  SEAT_STATUS,
  RESERVATION_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  LOCK_SETTINGS,
  RESERVATION_SETTINGS,
  CACHE_SETTINGS,
  PAGINATION_DEFAULTS,
  PAYMENT_SETTINGS,
  CACHE_KEYS,
  LOCK_KEYS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  
  // Middleware
  authenticateToken,
  requireAdmin,
  errorHandler,
  
  // Database
  db,
};
