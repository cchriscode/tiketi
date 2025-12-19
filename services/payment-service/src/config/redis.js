const redis = require('redis');
const { logger } = require('../utils/logger');

const client = redis.createClient({
  host: process.env.REDIS_HOST || 'dragonfly',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      return new Error('⚠️  End of retry');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('⚠️  Retry time exhausted');
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  },
});

client.on('error', (err) => {
  logger.error('⚠️  Redis Client Error', err);
});

client.on('connect', () => {
  logger.info('✅ Connected to Redis');
});

/**
 * Acquire distributed lock using Redis SET with NX and PX options
 * @param {string} lockKey - Key to lock
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Promise<boolean>} - True if lock acquired, false otherwise
 */
const acquireLock = (lockKey, ttl) => {
  return new Promise((resolve, reject) => {
    client.set(lockKey, '1', 'NX', 'PX', ttl, (err, reply) => {
      if (err) {
        reject(err);
      } else {
        resolve(reply === 'OK');
      }
    });
  });
};

/**
 * Release distributed lock
 * @param {string} lockKey - Key to release
 * @returns {Promise<void>}
 */
const releaseLock = (lockKey) => {
  return new Promise((resolve, reject) => {
    client.del(lockKey, (err, reply) => {
      if (err) {
        reject(err);
      } else {
        resolve(reply);
      }
    });
  });
};

module.exports = {
  client,
  acquireLock,
  releaseLock,
};
