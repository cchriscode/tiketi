// src/utils/logger.js
const winston = require('winston');
const jwt = require('jsonwebtoken');

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

const getUserInfo = req => {
  return jwt.decode(req.headers.authorization?.split(' ')[1] || '') || {
    userId: null,
    email: 'anonymous',
    role: 'guest'
  };
}

/**
 * 민감 데이터 마스킹 처리
 */
const sanitizeSensitiveData = (data) => {
  if (!data || typeof data !== 'object') return data;

  const sensitiveFields = [
    'password', 'passwordConfirm', 'currentPassword', 'newPassword',
    'cardNumber', 'cvv', 'cvc', 'cardCvv',
    'phone', 'phoneNumber', 'mobilePhone',
    'ssn', 'socialSecurityNumber',
    'accountNumber', 'bankAccount',
    'secret', 'apiKey', 'token', 'accessToken', 'refreshToken'
  ];

  const sanitized = Array.isArray(data) ? [...data] : { ...data };

  for (const key in sanitized) {
    // 민감 필드는 마스킹
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '***REDACTED***';
    }
    // 중첩 객체도 재귀적으로 처리
    else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeSensitiveData(sanitized[key]);
    }
  }

  return sanitized;
}

const logFormat = (req, res, args) => ({
  headers: {
    clientIp: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
  },
  request: {
    method: req.method,
    url: req.originalUrl,
    body: Object.keys(req.body || {}).length ? sanitizeSensitiveData(req.body) : undefined,
    query: Object.keys(req.query || {}).length ? req.query : undefined,
    params: Object.keys(req.params || {}).length ? req.params : undefined,
  },
  response: {
    statusCode: res.statusCode,
    ...(args?.response ? args.response : {}),
  },
  user: getUserInfo(req),
  message: 'backend log', // 로그 이쁘게 찍기 위해 기본 message 추가
  ...(args || {})
})

module.exports = {
  logger,
  logFormat
};