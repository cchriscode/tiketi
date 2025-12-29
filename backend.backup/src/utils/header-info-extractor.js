const headerInfoExtractor = (req) => ({
  clientIp: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
  userAgent: req.headers['user-agent'],
  requestId: req.headers['x-request-id'] || 'unknown', // 추적용 ID가 있다면
});

module.exports = headerInfoExtractor;