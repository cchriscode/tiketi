/**
 * Stats Service Constants
 */

const CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
};

// Reservation Status (read-only for stats)
const RESERVATION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

// Payment Status (read-only for stats)
const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

// Date Granularity for stats
const GRANULARITY = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
};

// Error Messages
const ERROR_MESSAGES = {
  UNAUTHORIZED: '권한이 없습니다.',
  INVALID_DATE_RANGE: '유효하지 않은 날짜 범위입니다.',
  DATABASE_ERROR: '데이터베이스 조회 실패',
};

module.exports = {
  CONFIG,
  RESERVATION_STATUS,
  PAYMENT_STATUS,
  GRANULARITY,
  ERROR_MESSAGES,
};
