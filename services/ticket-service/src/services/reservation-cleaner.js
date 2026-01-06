/**
 * Reservation Cleaner Service
 * Automatically cleans up expired temporary reservations
 */

const db = require('../config/database');
const { client: redisClient } = require('../config/redis');

const CLEANUP_INTERVAL_SECONDS = 30; // Run every 30 seconds

class ReservationCleaner {
  constructor() {
    this.cleanupInterval = null;
    this.io = null; // Socket.IO instance
  }

  /**
   * Set Socket.IO instance for real-time updates
   */
  setIO(io) {
    this.io = io;
    console.log('🔌 Socket.IO connected to ReservationCleaner');
  }

  /**
   * Start automatic cleanup process
   */
  start() {
    if (this.cleanupInterval) {
      console.log('⚠️  Reservation cleaner is already running');
      return;
    }

    const intervalMs = CLEANUP_INTERVAL_SECONDS * 1000;

    console.log(`🧹 Starting reservation cleaner (interval: ${CLEANUP_INTERVAL_SECONDS}s)`);

    // Run immediately once
    this.cleanup().catch(err => {
      console.error('❌ Initial cleanup failed:', err.message);
    });

    // Then run periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(err => {
        console.error('❌ Periodic cleanup failed:', err.message);
      });
    }, intervalMs);
  }

  /**
   * Stop automatic cleanup process
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('🛑 Reservation cleaner stopped');
    }
  }

  /**
   * Clean up expired reservations
   * @returns {Promise<number>} - Number of reservations cleaned
   */
  async cleanup() {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Find expired reservations
      // Use FOR UPDATE SKIP LOCKED to avoid race condition with payment confirm
      // Only process reservations that are both payment_status='pending' AND status='pending'
      const expiredReservations = await client.query(
        `SELECT id, event_id, user_id
         FROM ticket_schema.reservations
         WHERE payment_status = $1
         AND status = $1
         AND expires_at < NOW()
         FOR UPDATE SKIP LOCKED`,
        ['pending']
      );

      if (expiredReservations.rows.length === 0) {
        await client.query('COMMIT');
        return 0;
      }

      console.log(`🧹 Cleaning ${expiredReservations.rows.length} expired reservations...`);

      for (const reservation of expiredReservations.rows) {
        // Get reservation items (both seat-based and ticket-type-based)
        const itemsResult = await client.query(
          `SELECT seat_id, ticket_type_id, quantity
           FROM ticket_schema.reservation_items
           WHERE reservation_id = $1`,
          [reservation.id]
        );

        const seatIds = [];
        const ticketTypeUpdates = new Map(); // ticket_type_id -> quantity

        for (const item of itemsResult.rows) {
          // Collect seat IDs for seat-based reservations
          if (item.seat_id) {
            seatIds.push(item.seat_id);
          }

          // Collect ticket type quantities for non-seat reservations
          if (item.ticket_type_id) {
            const currentQty = ticketTypeUpdates.get(item.ticket_type_id) || 0;
            ticketTypeUpdates.set(item.ticket_type_id, currentQty + item.quantity);
          }
        }

        // Release seats (back to available)
        if (seatIds.length > 0) {
          await client.query(
            `UPDATE ticket_schema.seats
             SET status = $1, updated_at = NOW()
             WHERE id = ANY($2)`,
            ['available', seatIds]
          );

          // Emit socket event for real-time seat update
          if (this.io) {
            this.io.to(`event:${reservation.event_id}`).emit('seats-released', {
              eventId: reservation.event_id,
              seatIds: seatIds,
            });
          }
        }

        // Restore ticket type inventory for non-seat reservations
        for (const [ticketTypeId, quantity] of ticketTypeUpdates.entries()) {
          await client.query(
            `UPDATE ticket_schema.ticket_types
             SET available_quantity = available_quantity + $1
             WHERE id = $2`,
            [quantity, ticketTypeId]
          );
        }

        // Mark reservation as expired
        // Defensive WHERE: only update if still pending (prevent overwriting confirmed status)
        const updateResult = await client.query(
          `UPDATE ticket_schema.reservations
           SET status = $1, updated_at = NOW()
           WHERE id = $2
           AND status = 'pending'
           AND payment_status = 'pending'`,
          ['expired', reservation.id]
        );

        if (updateResult.rowCount > 0) {
          try {
            await redisClient.srem(`active:${reservation.event_id}`, reservation.user_id);
            await redisClient.zrem(`active:seen:${reservation.event_id}`, reservation.user_id);
          } catch (redisError) {
            console.log('Redis error (removeActiveUser):', redisError.message);
          }
        }
      }

      await client.query('COMMIT');

      console.log(`✅ Cleaned ${expiredReservations.rows.length} expired reservations`);

      return expiredReservations.rows.length;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// Singleton instance
const reservationCleaner = new ReservationCleaner();

module.exports = reservationCleaner;
