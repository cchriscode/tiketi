/**
 * Frontend Constants
 * Single Source of Truth for all constant values
 */

// Event Status
export const EVENT_STATUS = {
  UPCOMING: 'upcoming',
  ON_SALE: 'on_sale',
  ENDED: 'ended',
  CANCELLED: 'cancelled',
  SOLD_OUT: 'sold_out',
};

// Event Status Display
export const EVENT_STATUS_DISPLAY = {
  [EVENT_STATUS.UPCOMING]: '오픈 예정',
  [EVENT_STATUS.ON_SALE]: '예매 중',
  [EVENT_STATUS.ENDED]: '예매 종료',
  [EVENT_STATUS.CANCELLED]: '취소됨',
  [EVENT_STATUS.SOLD_OUT]: '매진',
};

// Event Status Messages
export const EVENT_STATUS_MESSAGES = {
  [EVENT_STATUS.UPCOMING]: '⏰ 판매 시작 전입니다',
  [EVENT_STATUS.ON_SALE]: '🎫 판매 중입니다',
  [EVENT_STATUS.ENDED]: '⏰ 판매가 종료되었습니다',
  [EVENT_STATUS.CANCELLED]: '❌ 취소된 이벤트입니다',
  [EVENT_STATUS.SOLD_OUT]: '🚫 매진되었습니다',
};

// Seat Status
export const SEAT_STATUS = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  LOCKED: 'locked',
  SELECTED: 'selected', // Frontend only - for user's own selection
};

// Seat Status Display
export const SEAT_STATUS_DISPLAY = {
  [SEAT_STATUS.AVAILABLE]: '선택 가능',
  [SEAT_STATUS.RESERVED]: '예약 완료',
  [SEAT_STATUS.LOCKED]: '선택 중',
  [SEAT_STATUS.SELECTED]: '선택됨',
};

// Seat Status Colors
export const SEAT_STATUS_COLORS = {
  [SEAT_STATUS.AVAILABLE]: '#4CAF50', // Green
  [SEAT_STATUS.RESERVED]: '#9E9E9E', // Gray
  [SEAT_STATUS.LOCKED]: '#FF9800', // Orange
  [SEAT_STATUS.SELECTED]: '#2196F3', // Blue
};

// Payment Methods
export const PAYMENT_METHODS = {
  NAVER_PAY: 'naver_pay',
  KAKAO_PAY: 'kakao_pay',
  BANK_TRANSFER: 'bank_transfer',
};

// Payment Method Display
export const PAYMENT_METHOD_DISPLAY = {
  [PAYMENT_METHODS.NAVER_PAY]: '네이버페이',
  [PAYMENT_METHODS.KAKAO_PAY]: '카카오페이',
  [PAYMENT_METHODS.BANK_TRANSFER]: '계좌이체',
};

// Reservation Settings
export const RESERVATION_SETTINGS = {
  MAX_SEATS_PER_RESERVATION: 1, // Changed from 4 to 1: 일반적으로 1인 1좌석 선택
  TEMPORARY_RESERVATION_MINUTES: 5,
};

// API Endpoints
export const API_ENDPOINTS = {
  // Seats
  GET_SEATS: (eventId) => `/seats/events/${eventId}`,
  RESERVE_SEATS: '/seats/reserve',
  GET_RESERVATION: (reservationId) => `/seats/reservation/${reservationId}`,
  GET_LAYOUTS: '/seats/layouts',
  
  // Payments
  PROCESS_PAYMENT: '/payments/process',
  GET_PAYMENT_METHODS: '/payments/methods',
};

// Error Messages
export const ERROR_MESSAGES = {
  SEAT_NOT_FOUND: '좌석을 찾을 수 없습니다.',
  SEAT_ALREADY_RESERVED: '이미 예약된 좌석입니다.',
  SEAT_LOCKED: '다른 사용자가 선택 중인 좌석입니다.',
  MAX_SEATS_EXCEEDED: `최대 ${RESERVATION_SETTINGS.MAX_SEATS_PER_RESERVATION}석까지 선택 가능합니다.`,
  NO_SEAT_SELECTED: '좌석을 선택해주세요.',
  RESERVATION_EXPIRED: '예약이 만료되었습니다.',
  PAYMENT_FAILED: '결제에 실패했습니다.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  SEAT_RESERVED: '좌석이 선택되었습니다.',
  PAYMENT_COMPLETED: '결제가 완료되었습니다.',
};

