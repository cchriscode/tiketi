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
  lazyConnect: true, // Don't connect immediately
  maxRetriesPerRequest: 1, // Fail fast
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

module.exports = { client: redisClient };
