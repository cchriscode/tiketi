const { client: redisClient } = require('../config/redis');

const CHANNEL = process.env.QUEUE_EVENTS_CHANNEL || 'tiketi:queue-events';

async function publishQueueEvent(event, payload) {
  try {
    await redisClient.publish(CHANNEL, JSON.stringify({ event, payload }));
  } catch (error) {
    console.log('Redis publish error (queue event):', error.message);
  }
}

module.exports = { publishQueueEvent, CHANNEL };
