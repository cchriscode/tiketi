/**
 * Auth Service - Database Configuration
 */

const { createPostgresPool } = require('@tiketi/database');

const pool = createPostgresPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to Auth Service database');
});

pool.on('error', (err) => {
  console.error('❌ Database error:', err);
});

module.exports = pool;
