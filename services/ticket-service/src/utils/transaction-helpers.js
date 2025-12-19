const db = require('../config/database');
const { logger } = require('../utils/logger');
const { acquireLock, releaseLock } = require('../config/redis');

/**
 * 트랜잭션 래퍼 - 자동으로 BEGIN/COMMIT/ROLLBACK 처리
 * @param {Function} callback - 트랜잭션 내에서 실행할 함수 (client를 인자로 받음)
 * @returns {Promise<any>} - callback의 반환값
 */
async function withTransaction(callback) {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 분산 락 래퍼 - 자동으로 락 획득/해제 처리
 * @param {string|string[]} lockKeys - 락 키 또는 락 키 배열
 * @param {number} ttl - 락 TTL (밀리초)
 * @param {Function} callback - 락 획득 후 실행할 함수
 * @returns {Promise<any>} - callback의 반환값
 */
async function withLock(lockKeys, ttl, callback) {
  const keys = Array.isArray(lockKeys) ? lockKeys : [lockKeys];
  const acquiredLocks = [];

  try {
    // 모든 락 획득 시도
    for (const lockKey of keys) {
      const locked = await acquireLock(lockKey, ttl);

      if (!locked) {
        throw new Error(`Failed to acquire lock: ${lockKey}`);
      }

      acquiredLocks.push(lockKey);
    }

    // 락 획득 성공 후 콜백 실행
    return await callback();

  } finally {
    // 획득한 모든 락 해제 (역순으로)
    for (const lockKey of acquiredLocks.reverse()) {
      try {
        await releaseLock(lockKey);
      } catch (releaseError) {
        logger.error(`Failed to release lock ${lockKey}: ${releaseError.message}`);
      }
    }
  }
}

module.exports = {
  withTransaction,
  withLock,
};
