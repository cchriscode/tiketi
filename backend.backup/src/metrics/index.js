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
  labelNames: ['event_id', 'event_title', 'artist'], // 이벤트별로 분리하여 수집
  registers: [register]
});

// 예약 취소 횟수
const reservationsCancelled = new client.Counter({
  name: 'tiketi_reservations_cancelled_total',
  help: 'Total reservations cancelled',
  labelNames: ['event_id', 'reason'],
  registers: [register]
});

// 결제(Payments)
// 결제 시도 횟수-
const paymentsTotal = new client.Counter({
  name: 'tiketi_payments_total',
  help: 'Total payment attempts',
  labelNames: ['status', 'event_id', 'payment_method'], // status: success, failed
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

// 인증(Auth)
// 로그인/회원가입 시도 수
const authAttempts = new client.Counter({
  name: 'tiketi_auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['type', 'status'], // type: login, register / status: success, failed
  registers: [register]
});

// 이벤트 조회수
const eventViews = new client.Counter({
  name: 'tiketi_event_views_total',
  help: 'Total event page views',
  labelNames: ['event_id', 'event_title'],
  registers: [register]
});

// 오늘 총 매출 (Gauge - 주기적으로 업데이트)
const dailyRevenue = new client.Gauge({
  name: 'tiketi_daily_revenue_total',
  help: 'Total revenue today (pre-calculated)',
  registers: [register]
});

// 오늘 결제 완료 건수
const dailyPayments = new client.Gauge({
  name: 'tiketi_daily_payments_total',
  help: 'Total successful payments today',
  registers: [register]
});

// 예약→결제 전환율
const reservationConversionRate = new client.Gauge({
  name: 'tiketi_reservation_conversion_rate',
  help: 'Reservation to payment conversion rate (%)',
  registers: [register]
});

// 이벤트별 예약 건수 (24시간)
const eventReservations24h = new client.Gauge({
  name: 'tiketi_event_reservations_24h',
  help: 'Reservations per event in last 24h',
  labelNames: ['event_id', 'event_title'],
  registers: [register]
});

// 이벤트별 매출 (24시간)
const eventRevenue24h = new client.Gauge({
  name: 'tiketi_event_revenue_24h',
  help: 'Revenue per event in last 24h',
  labelNames: ['event_id', 'event_title'],
  registers: [register]
});

// 이벤트별 평균 단가
const eventAvgPrice = new client.Gauge({
  name: 'tiketi_event_avg_price',
  help: 'Average price per event',
  labelNames: ['event_id', 'event_title'],
  registers: [register]
});

// 결제 수단별 건수 (24시간)
const paymentMethodCount = new client.Gauge({
  name: 'tiketi_payment_method_count_24h',
  help: 'Payment count by method in last 24h',
  labelNames: ['payment_method'],
  registers: [register]
});

// 전환 퍼널 비율
const conversionFunnelRate = new client.Gauge({
  name: 'tiketi_conversion_funnel_rate',
  help: 'Conversion funnel rate (%)',
  labelNames: ['stage'], // view, queue, reservation, payment
  registers: [register]
});

// 전환 퍼널 단계별 카운트
const conversionFunnel = new client.Counter({
  name: 'tiketi_conversion_funnel_total',
  help: 'Conversion funnel step counts',
  labelNames: ['stage', 'event_id'], // stage: view, seat_select, reservation, payment
  registers: [register]
});

// 좌석 예약 건수
const seatsReserved = new client.Counter({
  name: 'tiketi_seats_reserved_total',
  help: 'Total seats reserved',
  labelNames: ['event_id'],
  registers: [register]
});

// 좌석 가용 수 (현재 남은 좌석)
const seatsAvailable = new client.Gauge({
  name: 'tiketi_seats_available',
  help: 'Available seats per event',
  labelNames: ['event_id'],
  registers: [register]
});

// 예약 생성 건수
const reservationsCreated = new client.Counter({
  name: 'tiketi_reservations_created_total',
  help: 'Total reservations created',
  labelNames: ['event_id', 'status'],
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
  reservationsCancelled,
  reservationsCreated,
  paymentsTotal,
  paymentAmount,
  authAttempts,
  eventViews,
  dailyRevenue,
  dailyPayments,
  reservationConversionRate,
  eventReservations24h,
  eventRevenue24h,
  eventAvgPrice,
  paymentMethodCount,
  conversionFunnelRate,
  conversionFunnel,
  seatsReserved,
  seatsAvailable,

  // DB
  dbQueryDuration,
  dbConnections,
};