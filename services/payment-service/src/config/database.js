const { Pool } = require('pg');
const { logger } = require('@tiketi/common');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tiketi',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

pool.on('connect', () => {
  logger.info('✅ Connected to PostgreSQL');
});

const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

module.exports = {
  query,
  getClient,
  pool,
};
