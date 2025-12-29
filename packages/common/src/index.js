/**
 * @tiketi/common
 * Shared utilities for TIKETI microservices
 */

// Constants
const constants = require('./constants');

// Errors
const errors = require('./errors');

// Middleware
const { errorHandler } = require('./middleware/error-handler');

// Validators
const validators = require('./utils/validators');

module.exports = {
  ...constants,
  ...errors,
  errorHandler,
  ...validators,
};
