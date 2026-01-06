/**
 * Queue Processor Background Service
 * 대기열에서 사용자를 주기적으로 입장시키는 서비스
 */

const { client: redisClient } = require('../config/redis');
const { publishQueueEvent } = require('./queue-event-publisher');

class QueueProcessor {
  constructor() {
    this.interval = null;
    this.processingIntervalMs = parseInt(process.env.QUEUE_PROCESSOR_INTERVAL) || 10000; // 10초
    this.idleTimeoutMs = parseInt(process.env.QUEUE_IDLE_TIMEOUT_MS) || 90000; // 90초
    this.activeTtlSeconds = parseInt(process.env.QUEUE_ACTIVE_TTL_SECONDS) || 600; // 10분
    this.seenTtlSeconds = parseInt(process.env.QUEUE_SEEN_TTL_SECONDS) || 600; // 10분
    this.isRunning = false;
    this.errorCount = 0;
    this.maxErrors = 5;
    this.io = null; // Socket.IO instance
  }

  /**
   * Set Socket.IO instance for real-time updates
   */
  setIO(io) {
    this.io = io;
    console.log('🔌 Socket.IO connected to QueueProcessor');
  }

  /**
   * Queue processor 시작
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Queue processor already running');
      return;
    }

    this.isRunning = true;
    console.log(`🚀 Queue processor started (interval: ${this.processingIntervalMs}ms)`);

    this.interval = setInterval(async () => {
      try {
        await this.processAllQueues();
        this.errorCount = 0; // Reset on success
      } catch (error) {
        this.errorCount++;
        console.error(`❌ Queue processing error (${this.errorCount}/${this.maxErrors}):`, error.message);

        if (this.errorCount >= this.maxErrors) {
          console.error('⚠️  Too many errors, pausing queue processor');
          this.stop();
        }
      }
    }, this.processingIntervalMs);
  }

  /**
   * Queue processor 중지
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isRunning = false;
      console.log('🛑 Queue processor stopped');
    }
  }

  /**
   * 모든 활성 대기열 처리
   */
  async processAllQueues() {
    try {
      // Redis SCAN을 사용하여 모든 queue:* 키 찾기 (KEYS 대신 - 성능 개선)
      const queueKeys = await this.scanQueueKeys();
      const activeSeenKeys = await this.scanActiveSeenKeys();
      const queueKeySet = new Set(queueKeys);
      const eventIds = new Set([
        ...queueKeys.map(key => key.replace('queue:', '')),
        ...activeSeenKeys.map(key => key.replace('active:seen:', '')),
      ]);

      if (eventIds.size === 0) {
        return;
      }

      console.log(`🔄 Processing ${eventIds.size} event(s) with queues/active users...`);

      for (const eventId of eventIds) {
        await this.cleanStaleUsers(eventId);
        if (queueKeySet.has(`queue:${eventId}`)) {
          await this.processQueue(eventId);
        }
      }
    } catch (error) {
      console.error('Error processing queues:', error.message);
    }
  }

  async scanQueueKeys() {
    if (typeof redisClient.scanIterator === 'function') {
      const queueKeys = [];
      for await (const key of redisClient.scanIterator({ MATCH: 'queue:*', COUNT: 100 })) {
        queueKeys.push(key);
      }
      return queueKeys;
    }

    if (typeof redisClient.scan !== 'function') {
      return typeof redisClient.keys === 'function' ? await redisClient.keys('queue:*') : [];
    }

    const queueKeys = [];
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', 'queue:*', 'COUNT', 100);
      if (Array.isArray(keys) && keys.length > 0) {
        queueKeys.push(...keys);
      }
      cursor = nextCursor;
    } while (cursor !== '0');

    return queueKeys;
  }

  async scanActiveSeenKeys() {
    if (typeof redisClient.scanIterator === 'function') {
      const seenKeys = [];
      for await (const key of redisClient.scanIterator({ MATCH: 'active:seen:*', COUNT: 100 })) {
        seenKeys.push(key);
      }
      return seenKeys;
    }

    if (typeof redisClient.scan !== 'function') {
      return typeof redisClient.keys === 'function' ? await redisClient.keys('active:seen:*') : [];
    }

    const seenKeys = [];
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', 'active:seen:*', 'COUNT', 100);
      if (Array.isArray(keys) && keys.length > 0) {
        seenKeys.push(...keys);
      }
      cursor = nextCursor;
    } while (cursor !== '0');

    return seenKeys;
  }

  async cleanStaleUsers(eventId) {
    const queueKey = `queue:${eventId}`;
    const activeKey = `active:${eventId}`;
    const queueSeenKey = `queue:seen:${eventId}`;
    const activeSeenKey = `active:seen:${eventId}`;
    const staleBefore = Date.now() - this.idleTimeoutMs;

    const staleQueueUsers = await redisClient.zrangebyscore(queueSeenKey, 0, staleBefore);
    if (staleQueueUsers.length > 0) {
      await redisClient.zrem(queueKey, ...staleQueueUsers);
      await redisClient.zrem(queueSeenKey, ...staleQueueUsers);
    }

    const staleActiveUsers = await redisClient.zrangebyscore(activeSeenKey, 0, staleBefore);
    if (staleActiveUsers.length > 0) {
      await redisClient.srem(activeKey, ...staleActiveUsers);
      await redisClient.zrem(activeSeenKey, ...staleActiveUsers);
    }
  }

  /**
   * 특정 이벤트의 대기열 처리
   */
  async processQueue(eventId) {
    try {
      await this.cleanStaleUsers(eventId);

      const queueKey = `queue:${eventId}`;
      const activeKey = `active:${eventId}`;
      const queueSeenKey = `queue:seen:${eventId}`;
      const activeSeenKey = `active:seen:${eventId}`;

      // 현재 활성 사용자 수
      const currentUsers = await redisClient.scard(activeKey) || 0;

      // 임계값 (환경변수로 설정 가능, 기본 1000)
      const threshold = parseInt(process.env.QUEUE_THRESHOLD) || 1000;

      // 입장 가능한 인원
      const available = threshold - currentUsers;

      if (available <= 0) {
        return; // 입장 불가
      }

      // 대기열에서 입장 가능한 만큼 사용자 가져오기 (FIFO)
      const users = await redisClient.zrange(queueKey, 0, available - 1);

      if (users.length === 0) {
        return; // 대기열 비어있음
      }

      // 사용자들을 활성 상태로 전환
      for (const userId of users) {
        await redisClient.sadd(activeKey, userId);
        await redisClient.expire(activeKey, this.activeTtlSeconds);
        await redisClient.zadd(activeSeenKey, Date.now(), userId);
        await redisClient.expire(activeSeenKey, this.seenTtlSeconds);

        // Emit 'queue-entry-allowed' event to specific user
        const entryPayload = {
          eventId,
          userId,
          message: '입장이 허용되었습니다. 좌석을 선택해주세요.',
        };
        if (this.io) {
          this.io.to(`queue:${eventId}`).emit('queue-entry-allowed', entryPayload);
        }
        void publishQueueEvent('queue-entry-allowed', entryPayload);
      }

      // 대기열에서 제거
      await redisClient.zremrangebyrank(queueKey, 0, users.length - 1);
      await redisClient.zrem(queueSeenKey, ...users);

      // Emit 'queue-updated' event to all users in queue
      const remainingCount = await redisClient.zcard(queueKey) || 0;
      const updatePayload = {
        eventId,
        queueSize: remainingCount,
        currentUsers,
        threshold,
      };
      if (this.io) {
        this.io.to(`queue:${eventId}`).emit('queue-updated', updatePayload);
      }
      void publishQueueEvent('queue-updated', updatePayload);

      console.log(`✅ Admitted ${users.length} user(s) from queue for event ${eventId}`);

    } catch (error) {
      console.error(`Error processing queue for event ${eventId}:`, error.message);
    }
  }

  /**
   * 수동으로 특정 이벤트 큐 처리
   */
  async processQueueManually(eventId) {
    await this.processQueue(eventId);
  }
}

// Singleton instance
const queueProcessor = new QueueProcessor();

module.exports = queueProcessor;
