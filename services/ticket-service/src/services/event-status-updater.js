/**
 * Event Status Updater Service
 * 이벤트 상태를 실시간으로 자동 업데이트 (Ticket Service용)
 */

const db = require('../config/database');
const { client: redisClient } = require('../config/redis');

class EventStatusUpdater {
  constructor() {
    this.timeoutId = null;
    this.io = null;
  }

  /**
   * Socket.IO 인스턴스 설정
   */
  setIO(io) {
    this.io = io;
  }

  /**
   * 서비스 시작
   */
  start() {
    console.log('🔄 Starting event status updater (smart timer mode)');

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
      console.log('🛑 Event status updater stopped');
    }
  }

  /**
   * 타이머 재설정 (이벤트 생성/수정 시 호출)
   */
  reschedule() {
    console.log('🔄 Rescheduling event status updater...');

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
      console.error('❌ Calculate next update time error:', error);
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

    console.log(`⏰ 다음 상태 업데이트 예정: ${nextUpdateDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (${Math.round(delay / 1000)}초 후)`);

    this.timeoutId = setTimeout(() => {
      this.updateEventStatuses();
    }, delay);
  }

  /**
   * 이벤트 상태 업데이트
   */
  async updateEventStatuses() {
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
          console.log(`  📢 판매 시작: ${event.title}`);
          updatedEventIds.add(event.id);

          // WebSocket으로 상태 변경 브로드캐스트
          if (this.io) {
            this.io.to(`event:${event.id}`).emit('event-status-changed', {
              eventId: event.id,
              status: 'on_sale',
              message: '판매가 시작되었습니다'
            });
          }
        });
        updatedCount += upcomingToOnSale.rows.length;
      }

      // 2. upcoming/on_sale → ended (판매 종료 시간이 지나면)
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
          console.log(`  ⏰ 판매 종료: ${event.title}`);
          updatedEventIds.add(event.id);

          // WebSocket으로 상태 변경 브로드캐스트
          if (this.io) {
            this.io.to(`event:${event.id}`).emit('event-status-changed', {
              eventId: event.id,
              status: 'ended',
              message: '판매가 종료되었습니다'
            });
          }
        });
        updatedCount += toEnded.rows.length;
      }

      // 3. 공연이 끝난 이벤트를 ended로 변경
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
          console.log(`  🎭 공연 종료: ${event.title}`);
          updatedEventIds.add(event.id);

          // WebSocket으로 상태 변경 브로드캐스트
          if (this.io) {
            this.io.to(`event:${event.id}`).emit('event-status-changed', {
              eventId: event.id,
              status: 'ended',
              message: '공연이 종료되었습니다'
            });
          }
        });
        updatedCount += pastEventDate.rows.length;
      }

      // Redis 캐시 무효화
      if (updatedCount > 0) {
        console.log(`✅ ${updatedCount}개 이벤트 상태 업데이트 완료`);

        try {
          // ioredis uses .status property (not .isOpen)
          if (redisClient && redisClient.status === 'ready') {
            // 모든 이벤트 목록 캐시 삭제
            const keys = await redisClient.keys('events:*');
            if (keys.length > 0) {
              await redisClient.del(keys);
              console.log(`🗑️  이벤트 목록 캐시 ${keys.length}개 삭제`);
            }

            // 업데이트된 개별 이벤트 캐시 삭제
            for (const eventId of updatedEventIds) {
              await redisClient.del(`event:${eventId}`);
            }
            console.log(`🗑️  개별 이벤트 캐시 ${updatedEventIds.size}개 삭제`);
          }
        } catch (cacheError) {
          console.error('⚠️  캐시 삭제 실패:', cacheError.message);
        }
      } else {
        console.log('ℹ️  상태 변경 필요한 이벤트 없음');
      }

    } catch (error) {
      console.error('❌ Event status update failed:', error);
    } finally {
      // 다음 업데이트 스케줄링
      await this.scheduleNextUpdate();
    }
  }
}

// Singleton instance
const eventStatusUpdater = new EventStatusUpdater();

module.exports = eventStatusUpdater;
