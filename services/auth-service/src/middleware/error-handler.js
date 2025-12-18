const CustomError = require('../utils/custom-error');
const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let error = err;

  // Log the error
  logger.error({
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode || 500,
  });

  // If it's not a known error, create a generic one
  if (!(error instanceof CustomError)) {
    error = new CustomError(500, '서버 오류가 발생했습니다.', err.message);
  }

  // Send response
  return res.status(error.statusCode || 500).json({
    error: error.message,
    code: error.code,
  });
};

module.exports = errorHandler;
