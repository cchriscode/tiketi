/**
 * Authentication Middleware for Ticket Service
 */

const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-in-production-f8a7b6c5d4e3f2a1';

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
    }

    // Verify user still exists in database (from auth_schema)
    try {
      const result = await db.query(
        'SELECT id, email, name, role FROM auth_schema.users WHERE id = $1',
        [user.userId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: '사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.',
          code: 'USER_NOT_FOUND'
        });
      }

      req.user = user;
      req.userInfo = result.rows[0]; // Attach full user info
      next();
    } catch (dbError) {
      console.error('Auth error:', dbError.message);
      return res.status(500).json({ error: '인증 처리 중 오류가 발생했습니다.' });
    }
  });
};

const requireAdmin = (req, res, next) => {
  // Use req.userInfo.role (from database) for most up-to-date role
  // req.user.role is from JWT token and may be outdated
  if (req.userInfo.role !== 'admin') {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
  next();
};

module.exports = {
  authenticateToken,
  authenticate: authenticateToken, // Alias for backward compatibility
  requireAdmin,
};
