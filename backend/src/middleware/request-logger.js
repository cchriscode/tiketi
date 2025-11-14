const { query } = require('../config/database');
const { logger, logFormat } = require('../utils/logger');

const requestLogger = (req, res, next) => {
  const start = Date.now();

  // 응답이 끝날 때('finish') 실행될 리스너 등록
  // Node.js의 res 객체는 작업이 끝나면 'finish' 이벤트를 발생시킵니다.
  res.on('finish', () => {
    const duration = Date.now() - start;

    const logData = logFormat(req, res, {
      type: 'request',
      duration: `${duration}ms`,
      body: Object.keys(req.body).length ? req.body : undefined,
      query: Object.keys(req.query).length ? req.query : undefined,
      params: Object.keys(req.params).length ? req.params : undefined,
      responseBody: Object.keys(res.body || {}).length ? res.body : undefined,
    });

    // 상태 코드에 따라 로그 레벨 다르게 찍기
    if (res.statusCode >= 500) {
      // 500대는 errorHandler에서 이미 error 레벨로 찍힘
    } else if (res.statusCode >= 400) {
      // 에러지만 서버 로직 에러가 아닌 경우(404 등)도 있으니 warn이나 info 사용
      logger.warn(logData);
    } else {
      logger.info(logData);
    }
  });

  // 다음 미들웨어/라우터로 통과
  next();
};

module.exports = requestLogger;