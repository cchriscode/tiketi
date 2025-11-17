const client = require('prom-client');

// Prometheus에서 수집할 메트릭들을 담을 Registry 생성
const register = new client.Registry();

// 기본 메트릭 수집 (CPU, 메모리 등)
client.collectDefaultMetrics({ register });

// ==========================================
// 📊 HTTP 요청 관련 메트릭
// ==========================================

// 총 HTTP 요청 수
// method(GET/POST), path(/api/...), status(200/404 등) 별로 카운트
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register]
});

// HTTP 요청 처리 시간 Histogram
// 응답 시간 분포 파악용
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

// 현재 처리 중인 요청 수 (동시 요청 측정)
const activeRequests = new client.Gauge({
  name: 'http_requests_active',
  help: 'Number of active HTTP requests',
  registers: [register]
});

// ==========================================
// 🎫 비즈니스 메트릭
// ==========================================

// 대기열에 현재 몇 명이 있는지 (Gauge: 변수값)
const queueUsers = new client.Gauge({
  name: 'tiketi_queue_users_total',
  help: 'Number of users in queue',
  labelNames: ['event_id'], // 이벤트별로 분리하여 수집
  registers: [register]
});

// 대기열에서 대기한 시간
const queueWaitTime = new client.Histogram({
  name: 'tiketi_queue_wait_seconds',
  help: 'Queue waiting time in seconds',
  labelNames: ['event_id'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [register]
});

// 예약
// 예약 생성 (성공/실패, 이벤트별)
const reservationsCreated = new client.Counter({
  name: 'tiketi_reservations_created_total',
  help: 'Total reservations created',
  labelNames: ['event_id', 'status'],
  registers: [register]
});

// 예약 취소 횟수
const reservationsCancelled = new client.Counter({
  name: 'tiketi_reservations_cancelled_total',
  help: 'Total reservations cancelled',
  labelNames: ['event_id', 'reason'],
  registers: [register]
});

// 예약 만료 횟수
const reservationsExpired = new client.Counter({
  name: 'tiketi_reservations_expired_total',
  help: 'Total reservations expired',
  labelNames: ['event_id'],
  registers: [register]
});

// 결제(Payments)
// 결제 시도 횟수
const paymentsTotal = new client.Counter({
  name: 'tiketi_payments_total',
  help: 'Total payment attempts',
  labelNames: ['status', 'event_id'], // status: success, failed
  registers: [register]
});

// 결제 금액 분포
const paymentAmount = new client.Histogram({
  name: 'tiketi_payment_amount',
  help: 'Payment amount distribution',
  labelNames: ['event_id'],
  buckets: [10000, 50000, 100000, 150000, 200000, 300000],
  registers: [register]
});

// 좌석(Seat)
// 예약된 좌석 수
const seatsReserved = new client.Gauge({
  name: 'tiketi_seats_reserved_total',
  help: 'Number of reserved seats',
  labelNames: ['event_id'],
  registers: [register]
});

// 남은 좌석 수
const seatsAvailable = new client.Gauge({
  name: 'tiketi_seats_available_total',
  help: 'Number of available seats',
  labelNames: ['event_id'],
  registers: [register]
});

// 인증(Auth)
// 로그인/회원가입 시도 수
const authAttempts = new client.Counter({
  name: 'tiketi_auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['type', 'status'], // type: login, register / status: success, failed
  registers: [register]
});

// ==========================================
// 🗄️ 데이터베이스 메트릭
// ==========================================
// SQL 쿼리 실행 시간 측정
const dbQueryDuration = new client.Histogram({
  name: 'tiketi_db_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register]
});

// DB 커넥션 풀에서 현재 활성 커넥션 수
const dbConnections = new client.Gauge({
  name: 'tiketi_db_connections_active',
  help: 'Active database connections',
  registers: [register]
});

// ==========================================
// 외부에서 사용하도록 Export
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