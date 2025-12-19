const jwt = require('jsonwebtoken');
const { CONFIG } = require('../shared/constants');
const { logger } = require('../utils/logger');

/**
 * Ticket Service Auth Middleware
 * 
 * Auth Service로부터 발급받은 JWT 토큰 검증
 * TODO: Auth Service와의 분산 환경에서 토큰 검증 통합 필요
 */

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    jwt.verify(token, CONFIG.JWT_SECRET, (err, user) => {
      if (err) {
        logger.error('JWT verification failed:', err.message);
        return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
      }

      // TODO: Auth Service 호출하여 사용자 정보 검증
      // 현재는 JWT 토큰 검증만 수행
      req.user = user;
      next();
    });
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(500).json({ error: '인증 처리 중 오류가 발생했습니다.' });
  }
};

// alias for consistency
const authenticateToken = authenticate;

module.exports = {
  authenticate,
  authenticateToken,
};
