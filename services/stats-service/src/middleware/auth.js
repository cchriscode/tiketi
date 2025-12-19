const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { CONFIG } = require('../shared/constants');
const { logger } = require('../utils/logger');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  jwt.verify(token, CONFIG.JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
    }

    try {
      const result = await db.query(
        'SELECT id, email, name, role FROM users WHERE id = $1',
        [user.userId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: '사용자 정보를 찾을 수 없습니다.',
          code: 'USER_NOT_FOUND'
        });
      }

      req.user = user;
      req.userInfo = result.rows[0];
      next();
    } catch (dbError) {
      const error = new Error('인증 처리 중 오류가 발생했습니다.');
      error.status = 500;
      next(error);
    }
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
  next();
};

module.exports = { authenticateToken, requireAdmin };
