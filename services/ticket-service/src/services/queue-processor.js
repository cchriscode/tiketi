/**
 * Queue Processor Background Service
 * 대기열에서 사용자를 주기적으로 입장시키는 서비스
 */

const { client: redisClient } = require('../config/redis');

class QueueProcessor {
  constructor() {
    this.interval = null;
    this.processingIntervalMs = parseInt(process.env.QUEUE_PROCESSOR_INTERVAL) || 10000; // 10초
    this.isRunning = false;
    this.errorCount = 0;
    this.maxErrors = 5;
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
      // Redis에서 모든 queue:* 키 찾기
      const queueKeys = await redisClient.keys('queue:*');

      if (queueKeys.length === 0) {
        return;
      }

      console.log(`🔄 Processing ${queueKeys.length} queue(s)...`);

      for (const queueKey of queueKeys) {
        const eventId = queueKey.replace('queue:', '');
        await this.processQueue(eventId);
      }
    } catch (error) {
      console.error('Error processing queues:', error.message);
    }
  }

  /**
   * 특정 이벤트의 대기열 처리
   */
  async processQueue(eventId) {
    try {
      const queueKey = `queue:${eventId}`;
      const activeKey = `active:${eventId}`;

      // 현재 활성 사용자 수
      const currentUsers = await redisClient.sCard(activeKey) || 0;

      // 임계값 (기본 1000)
      const threshold = 1000;

      // 입장 가능한 인원
      const available = threshold - currentUsers;

      if (available <= 0) {
        return; // 입장 불가
      }

      // 대기열에서 입장 가능한 만큼 사용자 가져오기 (FIFO)
      const users = await redisClient.zRange(queueKey, 0, available - 1);

      if (users.length === 0) {
        return; // 대기열 비어있음
      }

      // 사용자들을 활성 상태로 전환
      for (const userId of users) {
        await redisClient.sAdd(activeKey, userId);
        await redisClient.expire(activeKey, 300); // 5분 타임아웃
      }

      // 대기열에서 제거
      await redisClient.zRemRangeByRank(queueKey, 0, users.length - 1);

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
