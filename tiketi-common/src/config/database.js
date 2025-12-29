const { Pool } = require('pg');
const { CONFIG } = require('../utils/constants');
const { logger } = require('../utils/logger');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres-service',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'tiketi',
  user: process.env.DB_USER || process.env.POSTGRES_USER || 'tiketi_user',
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'tiketi_pass',
  max: CONFIG.DB_POOL_MAX,
  idleTimeoutMillis: CONFIG.DB_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: CONFIG.DB_CONNECTION_TIMEOUT_MS,
});

pool.on('connect', () => {
  logger.info('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('❌ Unexpected error on idle client', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};
