/**
 * @tiketi/common - Validators
 * Common validation utilities
 */

const { validate: isUUID } = require('uuid');
const { ValidationError } = require('../errors');

function isValidUUID(value) {
  return typeof value === 'string' && isUUID(value);
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateRequired(fields, data) {
  const missing = [];

  for (const field of fields) {
    if (!data[field] && data[field] !== 0 && data[field] !== false) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
  }
}

function validateUUID(value, fieldName = 'ID') {
  if (!isValidUUID(value)) {
    throw new ValidationError(`Invalid ${fieldName} format`);
  }
}

function validateEmail(email) {
  if (!isValidEmail(email)) {
    throw new ValidationError('Invalid email format');
  }
}

module.exports = {
  isValidUUID,
  isValidEmail,
  validateRequired,
  validateUUID,
  validateEmail,
};
