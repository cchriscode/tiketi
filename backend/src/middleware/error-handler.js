const { logger, logFormat } = require('../utils/logger');
const CustomError = require('../utils/custom-error');
const { client } = require('../config/redis');

const errorHandler = (err, req, res, next) => {

  // Preserve explicit status codes on CustomError, fall back to cause or default 500
  const originErr = err.cause || err;
  const statusCode = err.statusCode || originErr.statusCode || 500;

  const errorLog = {
    statusCode,
    message: originErr.message,
    stack: originErr.stack,
    clientMessage: err.message,
  }

  // Winston으로 에러 로그 출력
  logger.error(logFormat(req, res, errorLog));

  // 클라이언트에게 응답
  res.status(statusCode).json({
    success: false,
    message: errorLog.clientMessage, // client 메시지만 전송
  });
};

module.exports = errorHandler;
