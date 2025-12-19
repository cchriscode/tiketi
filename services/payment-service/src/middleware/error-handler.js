const { logger } = require('../utils/logger');
const CustomError = require('../utils/custom-error');

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Log error
  if (err instanceof CustomError) {
    logger.warn(`⚠️  API Error: ${message}`, {
      statusCode,
      cause: err.cause?.message,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.error(`❌ Unexpected Error: ${message}`, {
      statusCode,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  res.status(statusCode).json({
    error: message,
    statusCode,
  });
};

module.exports = errorHandler;
