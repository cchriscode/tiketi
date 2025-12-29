/**
 * @tiketi/metrics
 * Prometheus metrics for microservices
 */

const client = require('prom-client');

const register = new client.Registry();

// Collect default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// HTTP Request Counter
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['service', 'method', 'path', 'status'],
  registers: [register]
});

// HTTP Request Duration
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['service', 'method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

// Business Metrics
const reservationsCreated = new client.Counter({
  name: 'tiketi_reservations_created_total',
  help: 'Total reservations created',
  labelNames: ['event_id', 'status'],
  registers: [register]
});

const seatsReserved = new client.Counter({
  name: 'tiketi_seats_reserved_total',
  help: 'Total seats reserved',
  labelNames: ['event_id'],
  registers: [register]
});

const queueUsers = new client.Gauge({
  name: 'tiketi_queue_users_total',
  help: 'Number of users in queue',
  labelNames: ['event_id'],
  registers: [register]
});

// Metrics middleware
function metricsMiddleware(serviceName) {
  return (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const labels = {
        service: serviceName,
        method: req.method,
        path: req.route?.path || req.path,
        status: res.statusCode
      };

      httpRequestCounter.labels(labels).inc();
      httpRequestDuration.labels(labels).observe(duration);
    });

    next();
  };
}

module.exports = {
  register,
  httpRequestCounter,
  httpRequestDuration,
  reservationsCreated,
  seatsReserved,
  queueUsers,
  metricsMiddleware,
};
