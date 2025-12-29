/**
 * Auth Service - Authentication Routes
 */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const {
  ValidationError,
  NotFoundError,
  ConflictError,
  AuthenticationError,
  validateRequired,
  validateEmail,
} = require('@tiketi/common');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_SALT_ROUNDS = 10;

/**
 * POST /auth/register
 * 회원가입
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, phone } = req.body;

    // Validation
    validateRequired(['email', 'password', 'name'], req.body);
    validateEmail(email);

    if (password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters');
    }

    // Check if user exists
    const existingUser = await db.query(
      'SELECT id FROM auth_schema.users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new ConflictError('이미 존재하는 이메일입니다.');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Insert user
    const result = await db.query(
      `INSERT INTO auth_schema.users (email, password_hash, name, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at`,
      [email, passwordHash, name, phone || null]
    );

    const user = result.rows[0];

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: '회원가입이 완료되었습니다.',
      token,
      user: {
        id: user.id,
        userId: user.id, // 기존 모놀리식과 호환성 유지
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/login
 * 로그인
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    validateRequired(['email', 'password'], req.body);
    validateEmail(email);

    // Find user
    const result = await db.query(
      'SELECT id, email, password_hash, name, role FROM auth_schema.users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw new AuthenticationError('이메일 또는 비밀번호가 일치하지 않습니다.');
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      throw new AuthenticationError('이메일 또는 비밀번호가 일치하지 않습니다.');
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: '로그인 성공',
      token,
      user: {
        id: user.id,
        userId: user.id, // 기존 모놀리식과 호환성 유지
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/me
 * 내 정보 조회 (인증 필요)
 */
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      throw new AuthenticationError('Invalid or expired token');
    }

    // Get user from DB
    const result = await db.query(
      'SELECT id, email, name, role, created_at FROM auth_schema.users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('User');
    }

    const user = result.rows[0];

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/verify-token
 * 토큰 검증 (내부 API - 다른 서비스용)
 */
router.post('/verify-token', async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new ValidationError('Token is required');
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      throw new AuthenticationError('Invalid or expired token');
    }

    // Get user from DB
    const result = await db.query(
      'SELECT id, email, name, role FROM auth_schema.users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('User');
    }

    const user = result.rows[0];

    res.json({
      valid: true,
      user: {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
