/**
 * Redis Configuration
 * For queue active user cleanup
 */

const Redis = require('ioredis');

const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy() {
    return null;
  },
});

redisClient.on('error', (err) => {
  console.log('Redis Client Error (payment-service):', err.message);
});

redisClient.on('connect', () => {
  console.log('Redis connected (payment-service)');
});

process.on('SIGINT', async () => {
  try {
    await redisClient.quit();
  } catch (err) {
    console.log('Redis shutdown error (payment-service):', err.message);
  }
  process.exit(0);
});

module.exports = { client: redisClient };
