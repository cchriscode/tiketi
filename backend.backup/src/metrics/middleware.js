const { 
  httpRequestCounter, 
  httpRequestDuration, 
  activeRequests 
} = require('./index');

// 모든 HTTP 요청에 대해 자동으로 Prometheus 메트릭을 기록하는 미들웨어
const metricsMiddleware = (req, res, next) => {
  // 헬스체크와 메트릭 엔드포인트는 제외
  if (req.path === '/health' || req.path === '/metrics') {
    return next();
  }

  const start = Date.now();
  activeRequests.inc();

  // 응답이 끝났을 때(res.finish 이벤트), Prometheus 메트릭을 업데이트함
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