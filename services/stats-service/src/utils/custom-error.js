class CustomError extends Error {
  constructor(statusCode, message, cause = null) {
    super(message);
    this.statusCode = statusCode;
    this.cause = cause;
    this.isOperational = true;
  }
}

module.exports = CustomError;
