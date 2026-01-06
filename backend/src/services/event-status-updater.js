/**
 * Event Status Updater Service
 * 이벤트 상태를 실시간으로 자동 업데이트
 */

const db = require('../config/database');
const { logger } = require('../utils/logger');

class EventStatusUpdater {
  constructor() {
    this.timeoutId = null;
  }

  /**
   * 서비스 시작
   */
  start() {
    logger.info('🔄 Starting event status updater (smart timer mode)');

    // 즉시 한 번 실행 후 다음 타이머 설정
    this.updateEventStatuses();
  }

  /**
   * 서비스 중지
   */
  stop() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
      logger.info('🛑 Event status updater stopped');
    }
  }

  /**
   * 타이머 재설정 (이벤트 생성/수정 시 호출)
   */
  reschedule() {
    logger.info('🔄 Rescheduling event status updater...');

    // 기존 타이머 취소
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // 즉시 상태 업데이트 실행
    this.updateEventStatuses();
  }

  /**
   * 다음 상태 변경 시점 계산
   */
  async calculateNextUpdateTime() {
    try {
      const now = new Date();

      // 가장 가까운 상태 변경 시점 찾기
      const result = await db.query(
        `SELECT
          LEAST(
            (SELECT MIN(sale_start_date) FROM ticket_schema.events WHERE status = 'upcoming' AND sale_start_date > $1),
            (SELECT MIN(sale_end_date) FROM ticket_schema.events WHERE status = 'on_sale' AND sale_end_date > $1)
          ) as next_change_time`,
        [now]
      );

      const nextChangeTime = result.rows[0].next_change_time;

      if (!nextChangeTime) {
        // 예정된 상태 변경이 없으면 1시간 후 다시 체크
        return 3600000;
      }

      const msUntilChange = new Date(nextChangeTime).getTime() - now.getTime();

      // 최소 1초, 최대 1시간으로 제한
      return Math.max(1000, Math.min(msUntilChange + 1000, 3600000)); // 1초 여유 추가

    } catch (error) {
      logger.error('❌ Calculate next update time error:', error);
      // 에러 시 1분 후 재시도
      return 60000;
    }
  }

  /**
   * 다음 업데이트 스케줄링
   */
  async scheduleNextUpdate() {
    const delay = await this.calculateNextUpdateTime();
    const nextUpdateDate = new Date(Date.now() + delay);

    logger.info(`⏰ 다음 상태 업데이트 예정: ${nextUpdateDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (${Math.round(delay / 1000)}초 후)`);

    this.timeoutId = setTimeout(() => {
      this.updateEventStatuses();
    }, delay);
  }

  /**
   * 이벤트 상태 업데이트
   */
  async updateEventStatuses() {
    const { client: redisClient } = require('../config/redis');

    try {
      const now = new Date();
      let updatedCount = 0;
      const updatedEventIds = new Set();

      // 1. upcoming → on_sale (판매 시작 시간이 되면)
      const upcomingToOnSale = await db.query(
        `UPDATE ticket_schema.events
         SET status = 'on_sale', updated_at = NOW()
         WHERE status = 'upcoming'
         AND sale_start_date <= $1
         AND sale_end_date > $1
         RETURNING id, title`,
        [now]
      );

      if (upcomingToOnSale.rows.length > 0) {
        upcomingToOnSale.rows.forEach(event => {
          logger.info(`  📢 판매 시작: ${event.title}`);
          updatedEventIds.add(event.id);
        });
        updatedCount += upcomingToOnSale.rows.length;
      }

      // 2. upcoming/on_sale → ended (판매 종료 시간이 지나면)
      // upcoming 상태에서도 바로 ended로 갈 수 있도록 수정
      const toEnded = await db.query(
        `UPDATE ticket_schema.events
         SET status = 'ended', updated_at = NOW()
         WHERE status IN ('upcoming', 'on_sale')
         AND sale_end_date <= $1
         AND status != 'cancelled'
         RETURNING id, title`,
        [now]
      );

      if (toEnded.rows.length > 0) {
        toEnded.rows.forEach(event => {
          logger.info(`  ⏰ 판매 종료: ${event.title}`);
          updatedEventIds.add(event.id);
        });
        updatedCount += toEnded.rows.length;
      }

      // 3. ended → ended (공연이 끝나면) - 이미 ended이지만 로그만 남김
      const pastEventDate = await db.query(
        `SELECT id, title
         FROM ticket_schema.events
         WHERE status != 'ended'
         AND status != 'cancelled'
         AND event_date < $1`,
        [now]
      );

      if (pastEventDate.rows.length > 0) {
        await db.query(
          `UPDATE ticket_schema.events
           SET status = 'ended', updated_at = NOW()
           WHERE status != 'ended'
           AND status != 'cancelled'
           AND event_date < $1`,
          [now]
        );

        pastEventDate.rows.forEach(event => {
          logger.info(`  🎭 공연 종료: ${event.title}`);
          updatedEventIds.add(event.id);
        });
        updatedCount += pastEventDate.rows.length;
      }

      // 캐시 무효화
      if (updatedCount > 0) {
        logger.info(`✅ ${updatedCount}개 이벤트 상태 업데이트 완료`);

        try {
          // 모든 이벤트 목록 캐시 삭제
          const keys = await redisClient.keys('events:*');
          if (keys.length > 0) {
            await redisClient.del(keys);
            logger.info(`🗑️  이벤트 목록 캐시 ${keys.length}개 삭제`);
          }

          // 업데이트된 개별 이벤트 캐시 삭제
          for (const eventId of updatedEventIds) {
            await redisClient.del(`event:${eventId}`);
          }
          logger.info(`🗑️  개별 이벤트 캐시 ${updatedEventIds.size}개 삭제`);
        } catch (cacheError) {
          logger.error('⚠️  캐시 삭제 실패:', cacheError.message);
        }
      } else {
        logger.info('ℹ️  상태 변경 필요한 이벤트 없음');
      }

    } catch (error) {
      logger.error('❌ Event status update failed:', error);
    } finally {
      // 다음 업데이트 스케줄링
      await this.scheduleNextUpdate();
    }
  }
}

// Singleton instance
const eventStatusUpdater = new EventStatusUpdater();

module.exports = eventStatusUpdater;

