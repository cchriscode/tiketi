/**
 * Auth Service Constants
 */

// Configuration
const CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
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

// User Roles
const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
};

// Error Messages
const ERROR_MESSAGES = {
  EMAIL_ALREADY_EXISTS: '이미 등록된 이메일입니다.',
  INVALID_EMAIL: '유효하지 않은 이메일입니다.',
  INVALID_PASSWORD: '비밀번호는 최소 6자 이상이어야 합니다.',
  INVALID_NAME: '이름을 입력해주세요.',
  USER_NOT_FOUND: '사용자를 찾을 수 없습니다.',
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 일치하지 않습니다.',
  TOKEN_EXPIRED: '토큰이 만료되었습니다.',
  INVALID_TOKEN: '유효하지 않은 토큰입니다.',
  UNAUTHORIZED: '인증되지 않은 요청입니다.',
  FORBIDDEN: '권한이 없습니다.',
};

// Success Messages
const SUCCESS_MESSAGES = {
  REGISTER_SUCCESS: '회원가입이 완료되었습니다.',
  LOGIN_SUCCESS: '로그인에 성공했습니다.',
  TOKEN_VERIFIED: '토큰이 유효합니다.',
};

module.exports = {
  CONFIG,
  USER_ROLES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
};
