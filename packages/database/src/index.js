/**
 * @tiketi/database
 * Database connection and utilities
 */

const { Pool } = require('pg');
const Redis = require('ioredis');

// PostgreSQL connection pool
function createPostgresPool(config) {
  const pool = new Pool({
    host: config.host || process.env.DB_HOST,
    port: config.port || process.env.DB_PORT || 5432,
    database: config.database || process.env.DB_NAME,
    user: config.user || process.env.DB_USER,
    password: config.password || process.env.DB_PASSWORD,
    max: config.max || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Set search_path on every new connection to support MSA schemas
  pool.on('connect', async (client) => {
    try {
      await client.query(`SET search_path TO ticket_schema, auth_schema, payment_schema, stats_schema, public`);
    } catch (err) {
      console.error('Failed to set search_path:', err.message);
    }
  });

  return pool;
}

// Redis client
function createRedisClient(url) {
  const redisUrl = url || process.env.REDIS_URL || 'redis://localhost:6379';
  return new Redis(redisUrl);
}

// Transaction helper
async function withTransaction(pool, callback) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Cache helper
class CacheManager {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  async get(key) {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key, value, ttl = 3600) {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async del(key) {
    await this.redis.del(key);
  }

  async invalidatePattern(pattern) {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

module.exports = {
  createPostgresPool,
  createRedisClient,
  withTransaction,
  CacheManager,
};
