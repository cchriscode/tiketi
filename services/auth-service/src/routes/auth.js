/**
 * Auth Service - Authentication Routes
 */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
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

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-in-production-f8a7b6c5d4e3f2a1';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_SALT_ROUNDS = 10;

// Google OAuth2 Client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

/**
 * POST /auth/google
 * Google OAuth 로그인
 */
router.post('/google', async (req, res, next) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      throw new ValidationError('Google credential이 필요합니다.');
    }

    // Google ID Token 검증
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload['sub'];
    const email = payload['email'];
    const name = payload['name'];
    const picture = payload['picture'];

    // 이메일로 기존 사용자 확인
    let result = await db.query(
      'SELECT id, email, name, role, google_id FROM auth_schema.users WHERE email = $1',
      [email]
    );

    let user;

    if (result.rows.length > 0) {
      // 기존 사용자 - Google ID 업데이트 (없는 경우)
      user = result.rows[0];

      if (!user.google_id) {
        await db.query(
          'UPDATE auth_schema.users SET google_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [googleId, user.id]
        );
      }
    } else {
      // 신규 사용자 - Google 계정으로 자동 회원가입
      result = await db.query(
        `INSERT INTO auth_schema.users (email, name, google_id, password_hash, role)
         VALUES ($1, $2, $3, $4, 'user')
         RETURNING id, email, name, role, google_id`,
        [email, name, googleId, ''] // password_hash는 빈 문자열 (Google 로그인 전용)
      );

      user = result.rows[0];
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: '구글 로그인 성공',
      token,
      user: {
        id: user.id,
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        picture: picture, // 구글 프로필 이미지
      }
    });
  } catch (error) {
    console.error('Google login error:', error);
    if (error.message && error.message.includes('Token')) {
      throw new AuthenticationError('유효하지 않은 Google 토큰입니다.');
    }
    next(error);
  }
});

module.exports = router;
