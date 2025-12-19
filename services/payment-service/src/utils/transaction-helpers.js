const db = require('../config/database');
const { logger } = require('./logger');

/**
 * 트랜잭션 래퍼 - 자동으로 BEGIN/COMMIT/ROLLBACK 처리
 * @param {Function} callback - 트랜잭션 내에서 실행할 함수 (client를 인자로 받음)
 * @returns {Promise<any>} - callback의 반환값
 *
 * @example
 * const result = await withTransaction(async (client) => {
 *   const res = await client.query('SELECT * FROM reservations WHERE id = $1', [id]);
 *   await client.query('UPDATE reservations SET payment_status = $1 WHERE id = $2', ['completed', id]);
 *   return res.rows[0];
 * });
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

module.exports = { withTransaction };
