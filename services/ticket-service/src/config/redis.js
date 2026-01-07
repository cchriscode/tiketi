/**
 * Redis Configuration
 * For queue management, caching, and distributed locks
 */

const Redis = require('ioredis');

// Build Redis connection config
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;
const redisPassword = process.env.REDIS_PASSWORD;

const redisClient = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  lazyConnect: false, // Connect immediately on startup
  maxRetriesPerRequest: 1, // Fail fast
  connectTimeout: 5000, // 5 second connection timeout
  commandTimeout: 500, // Fail after 500ms for any Redis command (fast-fail)
  retryStrategy(times) {
    // Don't retry - fail fast and continue without cache
    return null;
  }
});

// Handle Redis connection errors gracefully
redisClient.on('error', (err) => {
  console.log('Redis Client Error (will continue without cache):', err.message);
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await redisClient.quit();
  } catch (err) {
    console.log('Redis shutdown error (ignoring):', err.message);
  }
  process.exit(0);
});

// Helper function to wrap Redis operations with timeout
async function withTimeout(promise, timeoutMs = 2000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Redis operation timed out')), timeoutMs)
    )
  ]).catch((err) => {
    console.log(`Redis operation failed (${err.message}), continuing without cache`);
    return null;
  });
}

module.exports = { client: redisClient, withTimeout };
