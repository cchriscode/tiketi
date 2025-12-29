/**
 * Seat Generator Service
 * Generates seats for an event based on seat layout template
 * Single Responsibility: Seat generation logic only
 */

const db = require('../config/database');
const { logger } = require('../utils/logger');
const { SEAT_STATUS } = require('../shared/constants');

class SeatGenerator {
  /**
   * Generate seats for an event based on layout
   * @param {string} eventId - Event UUID
   * @param {string} seatLayoutId - Seat layout UUID
   * @param {object} providedClient - Optional: existing DB client (for use within transaction)
   * @returns {Promise<number>} - Number of seats created
   */
  async generateSeatsForEvent(eventId, seatLayoutId, providedClient = null) {
    const client = providedClient || await db.getClient();
    const isExternalTransaction = !!providedClient;

    try {
      if (!isExternalTransaction) {
        await client.query('BEGIN');
      }

      // Get layout configuration
      const layoutResult = await client.query(
        'SELECT layout_config FROM seat_layouts WHERE id = $1',
        [seatLayoutId]
      );

      if (layoutResult.rows.length === 0) {
        throw new Error('Seat layout not found');
      }

      const { layout_config } = layoutResult.rows[0];
      const sections = layout_config.sections;

      let totalSeatsCreated = 0;

      // Generate seats for each section
      for (const section of sections) {
        const {
          name: sectionName,
          rows,
          seatsPerRow,
          price,
          startRow = 1,
        } = section;

        // Generate seats for each row
        for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
          const rowNumber = startRow + rowIdx;

          // Generate seats in the row
          for (let seatNum = 1; seatNum <= seatsPerRow; seatNum++) {
            const seatLabel = this._generateSeatLabel(sectionName, rowNumber, seatNum);

            await client.query(
              `INSERT INTO seats (
                event_id, section, row_number, seat_number, seat_label, price, status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                eventId,
                sectionName,
                rowNumber,
                seatNum,
                seatLabel,
                price,
                SEAT_STATUS.AVAILABLE,
              ]
            );

            totalSeatsCreated++;
          }
        }
      }

      if (!isExternalTransaction) {
        await client.query('COMMIT');
      }
      logger.info(`✅ Generated ${totalSeatsCreated} seats for event ${eventId}`);
      return totalSeatsCreated;

    } catch (error) {
      if (!isExternalTransaction) {
        await client.query('ROLLBACK');
      }
      logger.error('Seat generation error:', error);
      throw error;
    } finally {
      if (!isExternalTransaction) {
        client.release();
      }
    }
  }

  /**
   * Generate seat label
   * @param {string} section - Section name
   * @param {number} row - Row number
   * @param {number} seat - Seat number
   * @returns {string} - Formatted seat label
   * @private
   */
  _generateSeatLabel(section, row, seat) {
    return `${section}-${row}-${seat}`;
  }

  /**
   * Check if seats already exist for event
   * @param {string} eventId - Event UUID
   * @returns {Promise<boolean>}
   */
  async seatsExist(eventId) {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM seats WHERE event_id = $1',
      [eventId]
    );
    return parseInt(result.rows[0].count) > 0;
  }

  /**
   * Delete all seats for an event
   * @param {string} eventId - Event UUID
   * @returns {Promise<number>} - Number of seats deleted
   */
  async deleteSeatsForEvent(eventId) {
    const result = await db.query(
      'DELETE FROM seats WHERE event_id = $1',
      [eventId]
    );
    return result.rowCount;
  }
}

module.exports = new SeatGenerator();

