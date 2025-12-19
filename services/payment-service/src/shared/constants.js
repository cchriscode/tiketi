/**
 * Payment Service Constants
 * Single Source of Truth for payment-related values
 */

// Configuration
const CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  JWT_EXPIRES_IN: '7d',
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

// Reservation Status
const RESERVATION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

// Seat Status
const SEAT_STATUS = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  LOCKED: 'locked',
};

// Payment Settings
const PAYMENT_SETTINGS = {
  MOCK_MIN_DELAY_MS: 500,
  MOCK_MAX_DELAY_MS: 1500,
};

// Error Messages
const ERROR_MESSAGES = {
  RESERVATION_NOT_FOUND: '예약을 찾을 수 없습니다.',
  RESERVATION_EXPIRED: '예약이 만료되었습니다.',
  PAYMENT_FAILED: '결제에 실패했습니다.',
  INVALID_PAYMENT_METHOD: '유효하지 않은 결제 수단입니다.',
  UNAUTHORIZED: '권한이 없습니다.',
};

// Success Messages
const SUCCESS_MESSAGES = {
  PAYMENT_COMPLETED: '결제가 완료되었습니다.',
};

module.exports = {
  CONFIG,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  RESERVATION_STATUS,
  SEAT_STATUS,
  PAYMENT_SETTINGS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
};
