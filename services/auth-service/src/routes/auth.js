const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db, CONFIG, CustomError, logger } = require('@tiketi/common');

const router = express.Router();

// Register
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
        throw new CustomError(400, '이미 등록된 이메일입니다.');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, CONFIG.BCRYPT_SALT_ROUNDS);

      // Insert user
      const result = await db.query(
        `INSERT INTO users (email, password, name, phone, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, name, role, created_at`,
        [email, hashedPassword, name, phone || null, 'user']
      );

      const user = result.rows[0];

      // Generate token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        CONFIG.JWT_SECRET,
        { expiresIn: CONFIG.JWT_EXPIRES_IN }
      );

      logger.info(`✅ New user registered: ${email}`);

      res.status(201).json({
        message: '회원가입이 완료되었습니다.',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Login
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
        throw new CustomError(401, '이메일 또는 비밀번호가 일치하지 않습니다.');
      }

      const user = result.rows[0];

      // Check password
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        throw new CustomError(401, '이메일 또는 비밀번호가 일치하지 않습니다.');
      }

      // Generate token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        CONFIG.JWT_SECRET,
        { expiresIn: CONFIG.JWT_EXPIRES_IN }
      );

      logger.info(`✅ User logged in: ${email}`);

      res.json({
        message: '로그인에 성공했습니다.',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
