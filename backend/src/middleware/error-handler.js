const { logger, logFormat } = require('../utils/logger');
const CustomError = require('../utils/custom-error');

const errorHandler = (err, req, res, next) => {

  // 1. 기본값 설정 (우리가 만든 CustomError가 아닌, 뜬금없는 에러가 터졌을 때 대비)
  let statusCode = err.statusCode || 500;
  let clientMessage = err.message || '알 수 없는 서버 에러가 발생했습니다.';
  let internalLog = err.cause || err; // cause가 있으면 그거 쓰고, 없으면 에러 객체 통째로

  // 2. 만약 AppError라면 우리가 의도한 대로 분리
  if (err instanceof CustomError) {
    statusCode = err.statusCode;
    clientMessage = err.message; // "아이디가 틀렸습니다"
    internalLog = err.cause || err.message; // "DB Error: User table connection timeout..."
  } else {
    // 2-1. CustomError가 아닌 경우 (예: 오타로 인한 ReferenceError 등)
    statusCode = 500;
    clientMessage = '잠시 후 다시 시도해주세요. (Internal Server Error)';
    internalLog = err; // 로그에는 전체 스택을 다 남김
  }

  // 3. Winston으로 에러 로그 출력
  logger.error(logFormat(req, res, {
    status: statusCode,
    message: err.message,
    clientMessage,
    internalLog,
    stack: err.stack,           // 에러 스택 트레이스
  }));

  // 4. 클라이언트에게 응답 (보안상 상세 스택은 숨기는 게 좋음)
  res.status(statusCode).json({
    success: false,
    message: clientMessage, // client 메시지만 전송
  });
};

module.exports = errorHandler;