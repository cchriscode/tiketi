const { seatsReserved, seatsAvailable } = require('./index');
const db = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * 좌석 메트릭 초기화
 * 서버 시작 시 DB에서 현재 좌석 상태를 읽어서 Prometheus Gauge에 반영
 */
async function initializeSeatMetrics() {
  try {
    logger.info('📊 Initializing seat metrics...');
    
    const result = await db.query(`
      SELECT 
        e.id as event_id,
        COUNT(CASE WHEN s.status = 'available' THEN 1 END) as available,
        COUNT(CASE WHEN s.status IN ('locked', 'reserved') THEN 1 END) as reserved
      FROM events e
      LEFT JOIN seats s ON e.id = s.event_id
      WHERE e.seat_layout_id IS NOT NULL
      GROUP BY e.id
    `);

    if (result.rows.length === 0) {
      logger.warn('⚠️  No events with seat layouts found');
      return;
    }

    for (const row of result.rows) {
      const available = parseInt(row.available) || 0;
      const reserved = parseInt(row.reserved) || 0;
      
      seatsAvailable.labels(row.event_id).set(available);
      seatsReserved.labels(row.event_id).set(reserved);
      
      logger.info(`  ✓ Event ${row.event_id}: ${reserved} reserved / ${available} available`);
    }

    logger.info('✅ Seat metrics initialized');
  } catch (error) {
    logger.error('❌ Seat metrics initialization failed:', error.message);
  }
}

/**
 * 모든 비즈니스 메트릭 초기화
 */
async function initializeMetrics() {
  await initializeSeatMetrics();
  // TODO: 향후 다른 메트릭 초기화 추가
}

module.exports = {
  initializeSeatMetrics,
  initializeMetrics,
};