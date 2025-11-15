// backend/src/metrics/middleware.js
const { 
  httpRequestCounter, 
  httpRequestDuration, 
  activeRequests 
} = require('./index');

// HTTP 메트릭 수집 미들웨어
const metricsMiddleware = (req, res, next) => {
  // 헬스체크와 메트릭 엔드포인트는 제외
  if (req.path === '/health' || req.path === '/metrics') {
    return next();
  }

  const start = Date.now();
  activeRequests.inc();

  res.on('finish', () => {
    const path = req.baseUrl + (req.route ? req.route.path : req.path);
    const status = res.statusCode;

    httpRequestCounter.labels(req.method, path, status).inc();
    httpRequestDuration.labels(req.method, path, status).observe((Date.now() - start) / 1000);
    activeRequests.dec();
  });

  next();
};

module.exports = metricsMiddleware;