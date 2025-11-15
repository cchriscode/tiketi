const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { client: redisClient } = require('../config/redis');

/**
 * 기본 Health Check
 * GET /health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * Database Health Check
 * GET /health/db
 */
router.get('/health/db', async (req, res) => {
  try {
    const start = Date.now();
    await db.query('SELECT 1');
    const responseTime = Date.now() - start;

    res.json({
      status: 'ok',
      service: 'database',
      responseTime: `${responseTime}ms`,
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(503).json({
      status: 'error',
      service: 'database',
      message: error.message,
    });
  }
});

/**
 * Redis Health Check
 * GET /health/redis
 */
router.get('/health/redis', async (req, res) => {
  try {
    const start = Date.now();
    await redisClient.ping();
    const responseTime = Date.now() - start;

    res.json({
      status: 'ok',
      service: 'redis',
      responseTime: `${responseTime}ms`,
    });
  } catch (error) {
    console.error('Redis health check failed:', error);
    res.status(503).json({
      status: 'error',
      service: 'redis',
      message: error.message,
    });
  }
});

/**
 * 전체 시스템 Health Check
 * GET /health/all
 */
router.get('/health/all', async (req, res) => {
  const checks = {
    server: {
      status: 'ok',
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
    },
    database: { status: 'unknown' },
    redis: { status: 'unknown' },
  };

  // Database check
  try {
    const start = Date.now();
    await db.query('SELECT 1');
    const responseTime = Date.now() - start;
    checks.database = {
      status: 'ok',
      responseTime: `${responseTime}ms`,
    };
  } catch (error) {
    checks.database = {
      status: 'error',
      message: error.message,
    };
  }

  // Redis check
  try {
    const start = Date.now();
    await redisClient.ping();
    const responseTime = Date.now() - start;
    checks.redis = {
      status: 'ok',
      responseTime: `${responseTime}ms`,
    };
  } catch (error) {
    checks.redis = {
      status: 'error',
      message: error.message,
    };
  }

  // 전체 상태 판단
  const allHealthy =
    checks.database.status === 'ok' && checks.redis.status === 'ok';
  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: allHealthy ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
