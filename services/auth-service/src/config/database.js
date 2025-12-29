const { Pool } = require('pg');
const { CONFIG, logger } = require('@tiketi/common');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tiketi',
  user: process.env.DB_USER || 'tiketi_user',
  password: process.env.DB_PASSWORD || 'tiketi_password',
  max: CONFIG.DB_POOL_MAX,
  idleTimeoutMillis: CONFIG.DB_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: CONFIG.DB_CONNECTION_TIMEOUT_MS,
});

pool.on('connect', () => {
  logger.info('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('❌ PostgreSQL pool error:', err);
});

module.exports = { pool };
