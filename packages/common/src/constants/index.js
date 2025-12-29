/**
 * @tiketi/common - Constants
 * Shared constants across all microservices
 */

// Event Status
const EVENT_STATUS = {
  UPCOMING: 'upcoming',
  ON_SALE: 'on_sale',
  ENDED: 'ended',
  CANCELLED: 'cancelled',
  SOLD_OUT: 'sold_out',
};

const EVENT_STATUS_MESSAGES = {
  upcoming: '판매 예정',
  on_sale: '판매 중',
  ended: '판매 종료',
  cancelled: '취소됨',
  sold_out: '매진',
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

// User Roles
const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
};

// Timeouts
const TIMEOUTS = {
  SEAT_LOCK_TTL: 600, // 10분 (초 단위)
  RESERVATION_EXPIRY: 900, // 15분 (초 단위)
  QUEUE_ENTRY_INTERVAL: 30, // 30초마다 입장
};

// Lock Keys
const LOCK_KEYS = {
  SEAT: (eventId, seatId) => `seat:${eventId}:${seatId}`,
  TICKET: (ticketTypeId) => `ticket:${ticketTypeId}`,
};

// Cache Keys
const CACHE_KEYS = {
  EVENT: (eventId) => `event:${eventId}`,
  EVENTS_LIST: (status, page, limit) => `events:${status||'all'}:${page}:${limit}`,
  SEATS: (eventId) => `seats:${eventId}`,
};

// Error Codes
const ERROR_CODES = {
  // Auth
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',

  // Tickets
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  SEAT_NOT_AVAILABLE: 'SEAT_NOT_AVAILABLE',
  SEAT_ALREADY_RESERVED: 'SEAT_ALREADY_RESERVED',
  SEAT_LOCKED: 'SEAT_LOCKED',

  // Payments
  RESERVATION_NOT_FOUND: 'RESERVATION_NOT_FOUND',
  RESERVATION_EXPIRED: 'RESERVATION_EXPIRED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',

  // General
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
};

module.exports = {
  EVENT_STATUS,
  EVENT_STATUS_MESSAGES,
  SEAT_STATUS,
  RESERVATION_STATUS,
  PAYMENT_STATUS,
  USER_ROLES,
  TIMEOUTS,
  LOCK_KEYS,
  CACHE_KEYS,
  ERROR_CODES,
};
