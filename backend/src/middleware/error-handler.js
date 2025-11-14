const { logger, logFormat } = require('../utils/logger');
const CustomError = require('../utils/custom-error');
const { client } = require('../config/redis');

const errorHandler = (err, req, res, next) => {

  const originErr = err.cause || err;
  const errorLog = {
    statusCode: originErr.statusCode ?? 500,
    message: originErr.message,
    stack: originErr.stack,
    clientMessage: err.message,
  }

  // Winston으로 에러 로그 출력
  logger.error(logFormat(req, res, errorLog));

  // 클라이언트에게 응답
  res.status(errorLog.statusCode).json({
    success: false,
    message: errorLog.clientMessage, // client 메시지만 전송
  });
};

module.exports = errorHandler;