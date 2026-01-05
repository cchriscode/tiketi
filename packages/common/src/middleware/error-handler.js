/**
 * @tiketi/common - Error Handler Middleware
 * Centralized error handling for all microservices
 */

const { CustomError } = require('../errors');

function errorHandler(err, req, res, next) {
  // Prevent double response if headers already sent
  if (res.headersSent) {
    console.error('[Error] Headers already sent, passing to default handler:', err.message);
    return next(err);
  }

  // Log error for debugging
  console.error('[Error]', {
    message: err.message,
    stack: err.stack,
    code: err.code,
    statusCode: err.statusCode,
    path: req.path,
    method: req.method,
  });

  // Default values
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Internal server error';

  // Response
  res.status(statusCode).json({
    error: message,
    code,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = { errorHandler };
