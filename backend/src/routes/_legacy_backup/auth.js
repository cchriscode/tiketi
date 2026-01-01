const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const db = require('../config/database');
const { CONFIG } = require('../shared/constants');
const CustomError = require('../utils/custom-error');

const router = express.Router();

// Google OAuth2 Client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: 회원가입
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 이메일
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: 비밀번호 (최소 6자)
 *               name:
 *                 type: string
 *                 description: 이름
 *               phone:
 *                 type: string
 *                 description: 전화번호
 *     responses:
 *       201:
 *         description: 회원가입 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                   description: JWT 토큰
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: 잘못된 요청 또는 이미 존재하는 이메일
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('name').trim().notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name, phone } = req.body;

      // Check if user exists
      const existingUser = await db.query(
        'SELECT id FROM auth_schema.users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: '이미 존재하는 이메일입니다.' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, CONFIG.BCRYPT_SALT_ROUNDS);

      // Insert user
      const result = await db.query(
        'INSERT INTO auth_schema.users (email, password_hash, name, phone) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
        [email, passwordHash, name, phone]
      );

      const user = result.rows[0];

      // Generate JWT
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        CONFIG.JWT_SECRET,
        { expiresIn: CONFIG.JWT_EXPIRES_IN }
      );

      res.status(201).json({
        message: '회원가입이 완료되었습니다.',
        token,
        user: {
          id: user.id,
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      });
    } catch (error) {
      next(new CustomError(500, '회원가입에 실패했습니다.', error));
    }
  }
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: 로그인
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 이메일
 *               password:
 *                 type: string
 *                 description: 비밀번호
 *     responses:
 *       200:
 *         description: 로그인 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                   description: JWT 토큰
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: 이메일 또는 비밀번호 불일치
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Get user
      const result = await db.query(
        'SELECT id, email, password_hash, name, role FROM auth_schema.users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: '가입된 아이디가 아닙니다.' });
      }

      const user = result.rows[0];

      // Check password
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        return res.status(401).json({ error: '가입된 아이디 혹은 비밀번호를 다시 확인해주세요.' });
      }

      // Generate JWT
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        CONFIG.JWT_SECRET,
        { expiresIn: CONFIG.JWT_EXPIRES_IN }
      );

      res.json({
        message: '로그인 성공',
        token,
        user: {
          id: user.id,
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      });
    } catch (error) {
      next(new CustomError(500, '로그인에 실패했습니다.', error));
    }
  }
);

/**
 * @swagger
 * /api/auth/google:
 *   post:
 *     summary: 구글 로그인
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - credential
 *             properties:
 *               credential:
 *                 type: string
 *                 description: Google ID Token (JWT)
 *     responses:
 *       200:
 *         description: 로그인 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: 유효하지 않은 Google 토큰
 */
router.post('/google', async (req, res, next) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Google credential이 필요합니다.' });
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
      CONFIG.JWT_SECRET,
      { expiresIn: CONFIG.JWT_EXPIRES_IN }
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
      return res.status(401).json({ error: '유효하지 않은 Google 토큰입니다.' });
    }
    next(new CustomError(500, '구글 로그인에 실패했습니다.', error));
  }
});

module.exports = router;

