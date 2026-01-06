/**
 * Queue Routes
 * 대기열 관리 API
 */

const express = require('express');
const { client: redisClient } = require('../config/redis');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate: isUUID } = require('uuid');

const router = express.Router();

const ensureValidEventId = (eventId, res) => {
  if (!isUUID(eventId)) {
    res.status(400).json({ error: 'Invalid event ID format' });
    return false;
  }
  return true;
};

// Event info cache
const eventCache = new Map();
async function getEventInfo(eventId) {
  if (eventCache.has(eventId)) {
    return eventCache.get(eventId);
  }

  try {
    const result = await db.query(
      'SELECT title, artist_name as artist FROM ticket_schema.events WHERE id = $1',
      [eventId]
    );

    const info = result.rows[0] || { title: 'Unknown', artist: 'Unknown' };
    eventCache.set(eventId, info);

    // 5분 후 캐시 만료
    setTimeout(() => eventCache.delete(eventId), 5 * 60 * 1000);

    return info;
  } catch (error) {
    console.error('Error fetching event info:', error.message);
    return { title: 'Unknown', artist: 'Unknown' };
  }
}

// Simple queue manager functions
const QueueManager = {
  async getThreshold(eventId) {
    // Read from environment variable, default to 1000
    return parseInt(process.env.QUEUE_THRESHOLD) || 1000;
  },

  async getCurrentUsers(eventId) {
    try {
      const key = `active:${eventId}`;
      return await redisClient.scard(key) || 0;
    } catch (error) {
      console.log('Redis error (getCurrentUsers):', error.message);
      return 0;
    }
  },

  async getQueueSize(eventId) {
    try {
      const key = `queue:${eventId}`;
      return await redisClient.zcard(key) || 0;
    } catch (error) {
      console.log('Redis error (getQueueSize):', error.message);
      return 0;
    }
  },

  async isInQueue(eventId, userId) {
    try {
      const key = `queue:${eventId}`;
      const score = await redisClient.zscore(key, userId);
      return score !== null;
    } catch (error) {
      console.log('Redis error (isInQueue):', error.message);
      return false;
    }
  },

  async isActiveUser(eventId, userId) {
    try {
      const key = `active:${eventId}`;
      return await redisClient.sismember(key, userId);
    } catch (error) {
      console.log('Redis error (isActiveUser):', error.message);
      return false;
    }
  },

  async getQueuePosition(eventId, userId) {
    try {
      const key = `queue:${eventId}`;
      const rank = await redisClient.zrank(key, userId);
      return rank !== null ? rank + 1 : 0;
    } catch (error) {
      console.log('Redis error (getQueuePosition):', error.message);
      return 0;
    }
  },

  async addToQueue(eventId, userId) {
    try {
      const key = `queue:${eventId}`;
      const timestamp = Date.now();
      await redisClient.zadd(key, timestamp, userId);
    } catch (error) {
      console.log('Redis error (addToQueue):', error.message);
    }
  },

  async addActiveUser(eventId, userId) {
    try {
      const key = `active:${eventId}`;
      await redisClient.sadd(key, userId);
      await redisClient.expire(key, 300); // 5분 후 만료
    } catch (error) {
      console.log('Redis error (addActiveUser):', error.message);
    }
  },

  async removeFromQueue(eventId, userId) {
    try {
      const key = `queue:${eventId}`;
      await redisClient.zrem(key, userId);
    } catch (error) {
      console.log('Redis error (removeFromQueue):', error.message);
    }
  },

  async removeActiveUser(eventId, userId) {
    try {
      const key = `active:${eventId}`;
      await redisClient.srem(key, userId);
    } catch (error) {
      console.log('Redis error (removeActiveUser):', error.message);
    }
  },

  async clearQueue(eventId) {
    try {
      const queueKey = `queue:${eventId}`;
      const activeKey = `active:${eventId}`;
      await redisClient.del(queueKey);
      await redisClient.del(activeKey);
    } catch (error) {
      console.log('Redis error (clearQueue):', error.message);
    }
  },

  getEstimatedWait(eventId, position) {
    // Simple estimation: 30 seconds per position
    return Math.max(position * 30, 0);
  },
};

/**
 * POST /queue/check/:eventId
 * 대기열 진입 확인
 */
router.post('/check/:eventId', authenticateToken, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!ensureValidEventId(eventId, res)) return;

    const userId = req.user.userId;
    const eventInfo = await getEventInfo(eventId);

    // Check if already in queue
    const inQueue = await QueueManager.isInQueue(eventId, userId);
    if (inQueue) {
      const position = await QueueManager.getQueuePosition(eventId, userId);
      const estimatedWait = QueueManager.getEstimatedWait(eventId, position);
      const currentUsers = await QueueManager.getCurrentUsers(eventId);
      const threshold = await QueueManager.getThreshold(eventId);

      return res.json({
        queued: true,
        position,
        estimatedWait,
        threshold,
        currentUsers,
        eventInfo,
      });
    }

    // Check if already active
    const isActive = await QueueManager.isActiveUser(eventId, userId);
    if (isActive) {
      const currentUsers = await QueueManager.getCurrentUsers(eventId);
      const threshold = await QueueManager.getThreshold(eventId);

      return res.json({
        queued: false,
        currentUsers,
        threshold,
        eventInfo,
      });
    }

    // New user - check threshold
    const currentUsers = await QueueManager.getCurrentUsers(eventId);
    const threshold = await QueueManager.getThreshold(eventId);

    if (currentUsers >= threshold) {
      // Add to queue
      await QueueManager.addToQueue(eventId, userId);
      const position = await QueueManager.getQueuePosition(eventId, userId);
      const estimatedWait = QueueManager.getEstimatedWait(eventId, position);

      return res.json({
        queued: true,
        position,
        estimatedWait,
        threshold,
        currentUsers,
        eventInfo,
      });
    } else {
      // Allow direct entry
      await QueueManager.addActiveUser(eventId, userId);

      return res.json({
        queued: false,
        currentUsers: currentUsers + 1,
        threshold,
        eventInfo,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /queue/status/:eventId
 * 대기열 상태 조회
 */
router.get('/status/:eventId', authenticateToken, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!ensureValidEventId(eventId, res)) return;

    const userId = req.user.userId;
    const inQueue = await QueueManager.isInQueue(eventId, userId);
    const isActive = await QueueManager.isActiveUser(eventId, userId);

    // Get current active users count (for UI display)
    const currentUsers = await QueueManager.getCurrentUsers(eventId);

    if (inQueue) {
      const position = await QueueManager.getQueuePosition(eventId, userId);
      const estimatedWait = QueueManager.getEstimatedWait(eventId, position);
      const queueSize = await QueueManager.getQueueSize(eventId);

      return res.json({
        status: 'queued',
        queued: true,
        currentUsers,
        position,
        estimatedWait,
        queueSize,
      });
    } else if (isActive) {
      return res.json({
        status: 'active',
        queued: false,
        currentUsers,
        message: '입장하였습니다.',
      });
    } else {
      return res.json({
        status: 'not_in_queue',
        queued: false,
        currentUsers,
        message: '대기열에 없습니다.',
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /queue/leave/:eventId
 * 대기열에서 나가기
 */
router.post('/leave/:eventId', authenticateToken, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!ensureValidEventId(eventId, res)) return;

    const userId = req.user.userId;
    await QueueManager.removeFromQueue(eventId, userId);
    await QueueManager.removeActiveUser(eventId, userId);

    res.json({ message: '대기열에서 나왔습니다.' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /queue/admin/:eventId
 * 대기열 정보 조회 (관리자)
 */
router.get('/admin/:eventId', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!ensureValidEventId(eventId, res)) return;

    const queueSize = await QueueManager.getQueueSize(eventId);
    const currentUsers = await QueueManager.getCurrentUsers(eventId);
    const threshold = await QueueManager.getThreshold(eventId);

    res.json({
      eventId,
      queueSize,
      currentUsers,
      threshold,
      available: threshold - currentUsers,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /queue/admin/clear/:eventId
 * 대기열 초기화 (관리자)
 */
router.post('/admin/clear/:eventId', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!ensureValidEventId(eventId, res)) return;

    await QueueManager.clearQueue(eventId);

    // Emit 'queue-cleared' event to all users in queue
    const io = req.app.locals.io;
    if (io) {
      io.to(`queue:${eventId}`).emit('queue-cleared', {
        eventId,
        message: '대기열이 초기화되었습니다.',
      });
    }

    res.json({ message: '대기열이 초기화되었습니다.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
