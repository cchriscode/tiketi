/**
 * Custom Error Class for consistent error handling
 */
class CustomError extends Error {
  constructor(statusCode, message, cause = null) {
    super(message);
    this.statusCode = statusCode;
    this.cause = cause;
    this.isOperational = true;
  }
}

module.exports = CustomError;
