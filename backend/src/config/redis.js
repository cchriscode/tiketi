const { createClient } = require('redis');

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  },
});

redisClient.on('error', (err) => {
  console.error('❌ Redis Client Error', err);
});

redisClient.on('connect', () => {
  console.log('✅ Connected to DragonflyDB (Redis)');
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
  }
})();

// Distributed lock helper
const acquireLock = async (key, ttl = 5000) => {
  const lockKey = `lock:${key}`;
  const lockValue = Date.now() + ttl;
  
  const result = await redisClient.set(lockKey, lockValue, {
    NX: true, // Only set if not exists
    PX: ttl,  // Expire after ttl milliseconds
  });
  
  return result === 'OK';
};

const releaseLock = async (key) => {
  const lockKey = `lock:${key}`;
  await redisClient.del(lockKey);
};

module.exports = {
  client: redisClient,
  acquireLock,
  releaseLock,
};

