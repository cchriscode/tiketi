/**
 * Application Constants
 * Single Source of Truth for all constant values
 */

// Configuration
const CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-secret-change-in-production-f8a7b6c5d4e3f2a1',
  JWT_EXPIRES_IN: '7d',
  BCRYPT_SALT_ROUNDS: 10,
  
  // Database
  DB_POOL_MAX: 20,
  DB_IDLE_TIMEOUT_MS: 30000,
  DB_CONNECTION_TIMEOUT_MS: 5000,
  
  // Admin Defaults (for development/demo only)
  DEFAULT_ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@tiketi.gg',
  DEFAULT_ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
  DEFAULT_ADMIN_NAME: '관리자',
  DEFAULT_ADMIN_PHONE: '010-1234-5678',
};

// Event Status
const EVENT_STATUS = {
  UPCOMING: 'upcoming',
  ON_SALE: 'on_sale',
  ENDED: 'ended',
  CANCELLED: 'cancelled',
  SOLD_OUT: 'sold_out',
};

// Seat Status
const SEAT_STATUS = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  LOCKED: 'locked',
};

// Reservation Status
const RESERVATION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

// Payment Status
const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

// Payment Methods
const PAYMENT_METHODS = {
  NAVER_PAY: 'naver_pay',
  KAKAO_PAY: 'kakao_pay',
  BANK_TRANSFER: 'bank_transfer',
};

// Lock Settings
const LOCK_SETTINGS = {
  SEAT_LOCK_TTL: 10000, // 10 seconds
  TICKET_LOCK_TTL: 10000, // 10 seconds
};

// Reservation Settings
const RESERVATION_SETTINGS = {
  MAX_SEATS_PER_RESERVATION: 1, // Maximum seats per reservation (1 seat per person)
  TEMPORARY_RESERVATION_MINUTES: 5, // 5 minutes
  CLEANUP_INTERVAL_SECONDS: 30, // 30 seconds
};

// Cache Settings
const CACHE_SETTINGS = {
  EVENTS_LIST_TTL: 30, // seconds (목록은 30초 캐시)
  EVENT_DETAIL_TTL: 10, // seconds (상세는 10초 캐시 - 실시간성 중요)
};

// Pagination Defaults
const PAGINATION_DEFAULTS = {
  PAGE: 1,
  EVENTS_LIMIT: 10,
  RESERVATIONS_LIMIT: 20,
};

// Payment Settings
const PAYMENT_SETTINGS = {
  MOCK_MIN_DELAY_MS: 500,
  MOCK_MAX_DELAY_MS: 1500,
};

// Cache Keys
const CACHE_KEYS = {
  EVENT: (eventId) => `event:${eventId}`,
  EVENTS_LIST: (status, page, limit, searchQuery) => `events:${status || 'all'}:${page}:${limit}:${searchQuery || 'none'}`,
  EVENTS_PATTERN: 'events:*', // 모든 이벤트 목록 캐시 패턴
  SEATS: (eventId) => `seats:${eventId}`,
};

// Lock Keys
const LOCK_KEYS = {
  SEAT: (eventId, seatId) => `seat:${eventId}:${seatId}`,
  TICKET: (ticketTypeId) => `ticket:${ticketTypeId}`,
};

// Error Messages
const ERROR_MESSAGES = {
  SEAT_NOT_FOUND: '좌석을 찾을 수 없습니다.',
  SEAT_ALREADY_RESERVED: '이미 예약된 좌석입니다.',
  SEAT_LOCKED: '다른 사용자가 선택 중인 좌석입니다. 잠시 후 다시 시도해주세요.',
  RESERVATION_NOT_FOUND: '예약을 찾을 수 없습니다.',
  RESERVATION_EXPIRED: '예약이 만료되었습니다.',
  PAYMENT_FAILED: '결제에 실패했습니다.',
  INVALID_PAYMENT_METHOD: '유효하지 않은 결제 수단입니다.',
  UNAUTHORIZED: '권한이 없습니다.',
};

// Success Messages
const SUCCESS_MESSAGES = {
  SEAT_RESERVED: '좌석이 선택되었습니다.',
  PAYMENT_COMPLETED: '결제가 완료되었습니다.',
  RESERVATION_CANCELLED: '예약이 취소되었습니다.',
};

module.exports = {
  CONFIG,
  EVENT_STATUS,
  SEAT_STATUS,
  RESERVATION_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  LOCK_SETTINGS,
  RESERVATION_SETTINGS,
  CACHE_SETTINGS,
  PAGINATION_DEFAULTS,
  PAYMENT_SETTINGS,
  CACHE_KEYS,
  LOCK_KEYS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
};

