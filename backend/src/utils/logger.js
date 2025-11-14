// src/utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info', // info 레벨 이상만 출력
  format: winston.format.combine(
    winston.format.timestamp(), // 시간 기록
    winston.format.json()       // ★핵심: JSON 형태로 출력
  ),
  transports: [
    new winston.transports.Console() // Docker 환경이므로 콘솔(stdout)에 출력하면 Promtail이 가져감
  ],
});

const headerInfoExtractor = (req) => ({
  clientIp: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
  userAgent: req.headers['user-agent'],
  requestId: req.headers['x-request-id'] || 'unknown', // 추적용 ID가 있다면
});

const logFormat = (req, res, args) => ({
  method: req.method,
  url: req.originalUrl,
  status: res.statusCode,
  headers: headerInfoExtractor(req),
  message: 'backend log', // 로그 이쁘게 찍기 위해 기본 message 추가
  ...(args || {})
})

module.exports = {
  logger,
  logFormat
};