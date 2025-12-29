/**
 * Database Configuration for Stats Service
 */

const { createPostgresPool } = require('@tiketi/database');

const pool = createPostgresPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'tiketi',
  user: process.env.DB_USER || 'tiketi_user',
  password: process.env.DB_PASSWORD || 'tiketi_pass',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
  } else {
    console.log('✅ PostgreSQL connected:', res.rows[0].now);
  }
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
