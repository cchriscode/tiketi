const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // CustomError 클래스 체크 (name으로)
  if (err.name === 'CustomError' || err.statusCode) {
    logger.error(err.message, {
      statusCode: err.statusCode || 500,
      stack: err.stack,
      cause: err.cause,
    });
    
    return res.status(err.statusCode || 500).json({
      error: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }

  // 기본 에러 처리
  logger.error('Original Error Cause:', {
    message: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { errorHandler };
