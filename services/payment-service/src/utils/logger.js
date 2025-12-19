const winston = require('winston');

// Create logger with JSON format
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
    }),
  ],
});

/**
 * Format log metadata for request context
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - Formatted log metadata
 */
const logFormat = (req, res) => ({
  method: req.method,
  path: req.path,
  statusCode: res.statusCode,
  userId: req.user?.userId || 'anonymous',
  ip: req.ip,
});

module.exports = { logger, logFormat };
