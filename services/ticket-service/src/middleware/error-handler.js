const { logger, logFormat } = require('../utils/logger');
const CustomError = require('../utils/custom-error');

const errorHandler = (err, req, res, next) => {
  const originErr = err.cause || err;
  const statusCode = err.statusCode || originErr.statusCode || 500;

  const errorLog = {
    statusCode,
    message: originErr.message,
    stack: originErr.stack,
    clientMessage: err.message,
  }

  logger.error(logFormat(req, res, errorLog));

  res.status(statusCode).json({
    success: false,
    message: errorLog.clientMessage,
  });
};

module.exports = errorHandler;
