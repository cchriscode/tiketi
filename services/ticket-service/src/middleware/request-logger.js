const { logger, logFormat } = require('../utils/logger');

const requestLogger = (req, res, next) => {
  // "/api" 로 시작하지 않으면 다음 미들웨어로
  if (!req.path || !req.path.startsWith('/api')) {
    return next();
  }

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    const logData = logFormat(req, res, {
      type: 'request',
      duration: `${duration}ms`
    });

    if (res.statusCode >= 500) {
      // 500대는 errorHandler에서 이미 error 레벨로 찍힘
    } else if (res.statusCode >= 400) {
      logger.warn(logData);
    } else {
      logger.info(logData);
    }
  });

  next();
};

module.exports = requestLogger;
