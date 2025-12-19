const { logger, logFormat } = require('../utils/logger');

const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log when response is finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const meta = logFormat(req, res);

    if (res.statusCode >= 500) {
      logger.error(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`, meta);
    } else if (res.statusCode >= 400) {
      logger.warn(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`, meta);
    } else {
      logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`, meta);
    }
  });

  next();
};

module.exports = requestLogger;
