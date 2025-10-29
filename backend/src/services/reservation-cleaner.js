/**
 * Reservation Cleaner Service
 * Automatically cleans up expired temporary reservations
 * Single Responsibility: Cleanup expired reservations
 */

const db = require('../config/database');
const { RESERVATION_STATUS, SEAT_STATUS, PAYMENT_STATUS, RESERVATION_SETTINGS } = require('../shared/constants');

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
    
    const intervalMs = RESERVATION_SETTINGS.CLEANUP_INTERVAL_SECONDS * 1000;
    
    console.log(`🧹 Starting reservation cleaner (interval: ${RESERVATION_SETTINGS.CLEANUP_INTERVAL_SECONDS}s)`);
    
    // Run immediately once (with error handling)
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
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Find expired reservations
      const expiredReservations = await client.query(
        `SELECT id, event_id 
         FROM reservations
         WHERE payment_status = $1
         AND expires_at < NOW()
         AND status != $2`,
        [PAYMENT_STATUS.PENDING, RESERVATION_STATUS.EXPIRED]
      );
      
      if (expiredReservations.rows.length === 0) {
        await client.query('COMMIT');
        return 0;
      }
      
      console.log(`🧹 Cleaning ${expiredReservations.rows.length} expired reservations...`);
      
      for (const reservation of expiredReservations.rows) {
        // Get seat IDs for this reservation
        const seatsResult = await client.query(
          `SELECT seat_id FROM reservation_items 
           WHERE reservation_id = $1 AND seat_id IS NOT NULL`,
          [reservation.id]
        );
        
        // Release seats back to available
        if (seatsResult.rows.length > 0) {
          const seatIds = seatsResult.rows.map(row => row.seat_id);

          await client.query(
            `UPDATE seats
             SET status = $1, updated_at = NOW()
             WHERE id = ANY($2) AND status = $3`,
            [SEAT_STATUS.AVAILABLE, seatIds, SEAT_STATUS.LOCKED]
          );

          // 실시간 좌석 해제 알림 (WebSocket)
          if (this.io) {
            try {
              for (const seatId of seatIds) {
                this.io.to(`seats:${reservation.event_id}`).emit('seat-released', {
                  seatId,
                  status: SEAT_STATUS.AVAILABLE,
                  timestamp: new Date(),
                });
              }
              console.log(`🪑 Seats released: ${seatIds.join(', ')} (event: ${reservation.event_id})`);
            } catch (socketError) {
              console.error('⚠️  WebSocket broadcast error:', socketError.message);
            }
          }
        }
        
        // Update reservation status to cancelled (expired reservations are marked as cancelled)
        await client.query(
          `UPDATE reservations 
           SET status = $1, updated_at = NOW()
           WHERE id = $2`,
          [RESERVATION_STATUS.CANCELLED, reservation.id]
        );
      }
      
      await client.query('COMMIT');
      
      console.log(`✅ Cleaned ${expiredReservations.rows.length} expired reservations`);
      return expiredReservations.rows.length;
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Reservation cleanup error:', error);
      return 0;
    } finally {
      client.release();
    }
  }
  
  /**
   * Manually expire a specific reservation
   * @param {string} reservationId - Reservation UUID
   * @returns {Promise<boolean>} - Success status
   */
  async expireReservation(reservationId) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get seat IDs
      const seatsResult = await client.query(
        `SELECT seat_id FROM reservation_items 
         WHERE reservation_id = $1 AND seat_id IS NOT NULL`,
        [reservationId]
      );
      
      // Release seats
      if (seatsResult.rows.length > 0) {
        const seatIds = seatsResult.rows.map(row => row.seat_id);
        
        await client.query(
          `UPDATE seats 
           SET status = $1, updated_at = NOW()
           WHERE id = ANY($2)`,
          [SEAT_STATUS.AVAILABLE, seatIds]
        );
      }
      
      // Update reservation
      await client.query(
        `UPDATE reservations 
         SET status = $1, updated_at = NOW()
         WHERE id = $2`,
        [RESERVATION_STATUS.EXPIRED, reservationId]
      );
      
      await client.query('COMMIT');
      return true;
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Expire reservation error:', error);
      return false;
    } finally {
      client.release();
    }
  }
}

// Export singleton instance
module.exports = new ReservationCleaner();

