/**
 * Initialize seats for events with seat layouts
 * Runs on server startup
 */

const db = require('./database');
const { SEAT_STATUS } = require('../shared/constants');
const { logger } = require('../utils/logger');

async function initSeats() {
  let client;

  try {
    logger.info('🎫 Checking seat initialization...');

    client = await db.getClient();

    // Find events with seat_layout_id but no seats
    const result = await client.query(
      `SELECT e.id, e.title, e.seat_layout_id, sl.layout_config
       FROM events e
       JOIN seat_layouts sl ON e.seat_layout_id = sl.id
       WHERE e.seat_layout_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM seats s WHERE s.event_id = e.id
       )`
    );

    if (result.rows.length === 0) {
      logger.info('✅ All events already have seats initialized\n');
      return;
    }

    logger.info(`📝 Generating seats for ${result.rows.length} events...\n`);

    for (const event of result.rows) {
      await client.query('BEGIN');

      try {
        const sections = event.layout_config.sections;
        let seatCount = 0;

        for (const section of sections) {
          for (let rowIdx = 0; rowIdx < section.rows; rowIdx++) {
            const rowNumber = section.startRow + rowIdx;

            for (let seatNum = 1; seatNum <= section.seatsPerRow; seatNum++) {
              const seatLabel = `${section.name}-${rowNumber}-${seatNum}`;

              await client.query(
                `INSERT INTO seats (event_id, section, row_number, seat_number, seat_label, price, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [event.id, section.name, rowNumber, seatNum, seatLabel, section.price, SEAT_STATUS.AVAILABLE]
              );
              seatCount++;
            }
          }
        }

        await client.query('COMMIT');
        logger.info(`✅ Generated ${seatCount} seats for: ${event.title}`);

      } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`❌ Failed to generate seats for ${event.title}: ${error.message}`);
      }
    }

    logger.info('✅ Seat initialization completed\n');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      logger.info('⏳ Database not ready yet, will retry on next request\n');
    } else {
      logger.error('❌ Seat initialization error:', error.message);
    }
  } finally {
    if (client) {
      client.release();
    }
  }
}

module.exports = initSeats;

