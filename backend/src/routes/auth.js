const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { CONFIG } = require('../shared/constants');
const CustomError = require('../utils/custom-error');

const router = express.Router();

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
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: '이미 존재하는 이메일입니다.' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, CONFIG.BCRYPT_SALT_ROUNDS);

      // Insert user
      const result = await db.query(
        'INSERT INTO users (email, password_hash, name, phone) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
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
        'SELECT id, email, password_hash, name, role FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다.' });
      }

      const user = result.rows[0];

      // Check password
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다.' });
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

module.exports = router;

