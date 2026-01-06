const { client: redisClient } = require('../config/redis');
const { logger } = require('../utils/logger');

const CHANNEL = process.env.QUEUE_EVENTS_CHANNEL || 'tiketi:queue-events';

async function startQueueEventSubscriber(io) {
  const subscriber = redisClient.duplicate();

  subscriber.on('error', (error) => {
    logger.error('Queue event subscriber error:', error);
  });

  try {
    await subscriber.connect();
  } catch (error) {
    logger.error('Failed to connect queue event subscriber:', error);
    return null;
  }

  await subscriber.subscribe(CHANNEL, (message) => {
    let parsed;
    try {
      parsed = JSON.parse(message);
    } catch (error) {
      logger.warn('Invalid queue event payload');
      return;
    }

    const event = parsed?.event;
    const payload = parsed?.payload;

    if (!event || !payload?.eventId) {
      logger.warn('Queue event missing eventId');
      return;
    }

    io.to(`queue:${payload.eventId}`).emit(event, payload);
  });

  logger.info(`Queue event subscriber listening on ${CHANNEL}`);
  return subscriber;
}

module.exports = {
  startQueueEventSubscriber,
  CHANNEL,
};
