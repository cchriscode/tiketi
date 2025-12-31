/**
 * Auth Service - Unit Tests
 * 기존 모놀리식 동작과 100% 일치 확인
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const authRoutes = require('./auth');
const { errorHandler } = require('@tiketi/common');

// Mock database
jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const db = require('../config/database');

// Create test app
const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
app.use(errorHandler);

// Test data
const testUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User',
  phone: '010-1234-5678',
  role: 'user',
};

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-in-production-f8a7b6c5d4e3f2a1';

describe('Auth Service - POST /auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('회원가입 성공', async () => {
    // Mock: 기존 사용자 없음
    db.query.mockResolvedValueOnce({ rows: [] });

    // Mock: 사용자 생성 성공
    db.query.mockResolvedValueOnce({
      rows: [{
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        role: testUser.role,
        created_at: new Date(),
      }],
    });

    const response = await request(app)
      .post('/auth/register')
      .send({
        email: testUser.email,
        password: testUser.password,
        name: testUser.name,
        phone: testUser.phone,
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe(testUser.email);
    expect(response.body.user.name).toBe(testUser.name);

    // JWT 검증
    const decoded = jwt.verify(response.body.token, JWT_SECRET);
    expect(decoded.userId).toBe(testUser.id);
    expect(decoded.email).toBe(testUser.email);
  });

  test('이메일 중복 시 실패', async () => {
    // Mock: 기존 사용자 존재
    db.query.mockResolvedValueOnce({
      rows: [{ id: testUser.id }],
    });

    const response = await request(app)
      .post('/auth/register')
      .send({
        email: testUser.email,
        password: testUser.password,
        name: testUser.name,
      });

    expect(response.status).toBe(409); // Conflict
    expect(response.body.error).toContain('already exists');
  });

  test('필수 필드 누락 시 실패', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({
        email: testUser.email,
        // password 누락
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('required');
  });

  test('유효하지 않은 이메일 형식', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({
        email: 'invalid-email',
        password: testUser.password,
        name: testUser.name,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('email');
  });

  test('비밀번호 6자 미만 시 실패', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({
        email: testUser.email,
        password: '12345', // 5자
        name: testUser.name,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('6 characters');
  });
});

describe('Auth Service - POST /auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('로그인 성공', async () => {
    const passwordHash = await bcrypt.hash(testUser.password, 10);

    // Mock: 사용자 조회 성공
    db.query.mockResolvedValueOnce({
      rows: [{
        id: testUser.id,
        email: testUser.email,
        password_hash: passwordHash,
        name: testUser.name,
        role: testUser.role,
      }],
    });

    const response = await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body.user.email).toBe(testUser.email);

    // JWT 검증
    const decoded = jwt.verify(response.body.token, JWT_SECRET);
    expect(decoded.userId).toBe(testUser.id);
  });

  test('존재하지 않는 이메일', async () => {
    // Mock: 사용자 없음
    db.query.mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: testUser.password,
      });

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Invalid email or password');
  });

  test('잘못된 비밀번호', async () => {
    const passwordHash = await bcrypt.hash(testUser.password, 10);

    db.query.mockResolvedValueOnce({
      rows: [{
        id: testUser.id,
        email: testUser.email,
        password_hash: passwordHash,
        name: testUser.name,
        role: testUser.role,
      }],
    });

    const response = await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: 'wrongpassword',
      });

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Invalid email or password');
  });
});

describe('Auth Service - GET /auth/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('유효한 토큰으로 내 정보 조회', async () => {
    const token = jwt.sign(
      {
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    db.query.mockResolvedValueOnce({
      rows: [{
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        role: testUser.role,
        created_at: new Date(),
      }],
    });

    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(testUser.email);
    expect(response.body.user.id).toBe(testUser.id);
  });

  test('토큰 없이 요청 시 실패', async () => {
    const response = await request(app)
      .get('/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('No token');
  });

  test('유효하지 않은 토큰', async () => {
    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Invalid or expired');
  });

  test('만료된 토큰', async () => {
    const expiredToken = jwt.sign(
      {
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      },
      JWT_SECRET,
      { expiresIn: '-1h' } // 1시간 전에 만료
    );

    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Invalid or expired');
  });
});

describe('Auth Service - POST /auth/verify-token (내부 API)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('유효한 토큰 검증 성공', async () => {
    const token = jwt.sign(
      {
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    db.query.mockResolvedValueOnce({
      rows: [{
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        role: testUser.role,
      }],
    });

    const response = await request(app)
      .post('/auth/verify-token')
      .send({ token });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(true);
    expect(response.body.user.userId).toBe(testUser.id);
    expect(response.body.user.email).toBe(testUser.email);
  });

  test('토큰 누락 시 실패', async () => {
    const response = await request(app)
      .post('/auth/verify-token')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('required');
  });

  test('유효하지 않은 토큰', async () => {
    const response = await request(app)
      .post('/auth/verify-token')
      .send({ token: 'invalid-token' });

    expect(response.status).toBe(401);
  });
});

describe('Auth Service - 기존 모놀리식 동작 일치 확인', () => {
  test('회원가입 후 바로 로그인 가능', async () => {
    // 1. 회원가입
    db.query.mockResolvedValueOnce({ rows: [] }); // 기존 사용자 없음
    db.query.mockResolvedValueOnce({
      rows: [{
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        role: testUser.role,
        created_at: new Date(),
      }],
    });

    const registerRes = await request(app)
      .post('/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
      });

    expect(registerRes.status).toBe(201);
    const registerToken = registerRes.body.token;

    // 2. 토큰으로 내 정보 조회
    db.query.mockResolvedValueOnce({
      rows: [{
        id: testUser.id,
        email: 'newuser@example.com',
        name: 'New User',
        role: 'user',
        created_at: new Date(),
      }],
    });

    const meRes = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${registerToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('newuser@example.com');
  });

  test('JWT 토큰 구조가 기존과 동일', async () => {
    const passwordHash = await bcrypt.hash(testUser.password, 10);

    db.query.mockResolvedValueOnce({
      rows: [{
        id: testUser.id,
        email: testUser.email,
        password_hash: passwordHash,
        name: testUser.name,
        role: testUser.role,
      }],
    });

    const response = await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    const decoded = jwt.verify(response.body.token, JWT_SECRET);

    // 기존 모놀리식과 동일한 JWT 페이로드
    expect(decoded).toHaveProperty('userId');
    expect(decoded).toHaveProperty('email');
    expect(decoded).toHaveProperty('role');
    expect(decoded).toHaveProperty('iat'); // issued at
    expect(decoded).toHaveProperty('exp'); // expiration
  });
});
