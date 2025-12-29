const winston = require('winston');
const jwt = require('jsonwebtoken');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ],
});

const getUserInfo = req => {
  return jwt.decode(req.headers.authorization?.split(' ')[1] || '') || {
    userId: null,
    email: 'anonymous',
    role: 'guest'
  };
}

const logFormat = (req, res, args) => ({
  headers: {
    clientIp: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
  },
  request: {
    method: req.method,
    url: req.originalUrl,
    body: Object.keys(req.body || {}).length ? req.body : undefined,
    query: Object.keys(req.query || {}).length ? req.query : undefined,
    params: Object.keys(req.params || {}).length ? req.params : undefined,
  },
  response: {
    statusCode: res.statusCode,
    ...(args?.response ? args.response : {}),
  },
  user: getUserInfo(req),
  message: 'auth-service log',
  ...(args || {})
})

module.exports = {
  logger,
  logFormat
};

// 새로운 기능: 구조화된 로깅
logger.logRequest = (req) => {
  logger.info('API Request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
};
