// backend/src/metrics/index.js
const client = require('prom-client');

// Registry 생성
const register = new client.Registry();

// 기본 메트릭 수집 (CPU, 메모리 등)
client.collectDefaultMetrics({ register });

// ==========================================
// 📊 HTTP 메트릭
// ==========================================

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register]
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

const activeRequests = new client.Gauge({
  name: 'http_requests_active',
  help: 'Number of active HTTP requests',
  registers: [register]
});

// ==========================================
// 🎫 비즈니스 메트릭
// ==========================================

// 대기열
const queueUsers = new client.Gauge({
  name: 'tiketi_queue_users_total',
  help: 'Number of users in queue',
  labelNames: ['event_id'],
  registers: [register]
});

const queueWaitTime = new client.Histogram({
  name: 'tiketi_queue_wait_seconds',
  help: 'Queue waiting time in seconds',
  labelNames: ['event_id'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [register]
});

// 예약
const reservationsCreated = new client.Counter({
  name: 'tiketi_reservations_created_total',
  help: 'Total reservations created',
  labelNames: ['event_id', 'status'],
  registers: [register]
});

const reservationsCancelled = new client.Counter({
  name: 'tiketi_reservations_cancelled_total',
  help: 'Total reservations cancelled',
  labelNames: ['event_id', 'reason'],
  registers: [register]
});

const reservationsExpired = new client.Counter({
  name: 'tiketi_reservations_expired_total',
  help: 'Total reservations expired',
  labelNames: ['event_id'],
  registers: [register]
});

// 결제
const paymentsTotal = new client.Counter({
  name: 'tiketi_payments_total',
  help: 'Total payment attempts',
  labelNames: ['status', 'event_id'], // status: success, failed
  registers: [register]
});

const paymentAmount = new client.Histogram({
  name: 'tiketi_payment_amount',
  help: 'Payment amount distribution',
  labelNames: ['event_id'],
  buckets: [10000, 50000, 100000, 150000, 200000, 300000],
  registers: [register]
});

// 좌석
const seatsReserved = new client.Gauge({
  name: 'tiketi_seats_reserved_total',
  help: 'Number of reserved seats',
  labelNames: ['event_id'],
  registers: [register]
});

const seatsAvailable = new client.Gauge({
  name: 'tiketi_seats_available_total',
  help: 'Number of available seats',
  labelNames: ['event_id'],
  registers: [register]
});

// 인증
const authAttempts = new client.Counter({
  name: 'tiketi_auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['type', 'status'], // type: login, register / status: success, failed
  registers: [register]
});

// ==========================================
// 🗄️ 데이터베이스 메트릭
// ==========================================

const dbQueryDuration = new client.Histogram({
  name: 'tiketi_db_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register]
});

const dbConnections = new client.Gauge({
  name: 'tiketi_db_connections_active',
  help: 'Active database connections',
  registers: [register]
});

// ==========================================
// Export
// ==========================================

module.exports = {
  register,
  
  // HTTP
  httpRequestCounter,
  httpRequestDuration,
  activeRequests,
  
  // 비즈니스
  queueUsers,
  queueWaitTime,
  reservationsCreated,
  reservationsCancelled,
  reservationsExpired,
  paymentsTotal,
  paymentAmount,
  seatsReserved,
  seatsAvailable,
  authAttempts,
  
  // DB
  dbQueryDuration,
  dbConnections,
};