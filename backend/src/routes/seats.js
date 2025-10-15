/**
 * Seats Router
 * Handles seat selection and reservation APIs
 */

const express = require('express');
const db = require('../config/database');
const { acquireLock, releaseLock, client: redisClient } = require('../config/redis');
const { authenticateToken } = require('../middleware/auth');
const {
  SEAT_STATUS,
  RESERVATION_STATUS,
  PAYMENT_STATUS,
  LOCK_SETTINGS,
  LOCK_KEYS,
  CACHE_KEYS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  RESERVATION_SETTINGS,
} = require('../shared/constants');

const router = express.Router();

/**
 * GET /api/seats/layouts
 * Get all available seat layouts
 */
router.get('/layouts', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, description, total_seats, layout_config
       FROM seat_layouts
       ORDER BY total_seats ASC`
    );

    res.json({
      layouts: result.rows,
    });
  } catch (error) {
    console.error('Get seat layouts error:', error);
    res.status(500).json({ error: 'Failed to fetch seat layouts' });
  }
});

/**
 * GET /api/seats/events/:eventId
 * Get all seats for an event with real-time status
 */
router.get('/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Get event info and layout
    const eventResult = await db.query(
      `SELECT e.id, e.title, e.seat_layout_id, sl.layout_config
       FROM events e
       LEFT JOIN seat_layouts sl ON e.seat_layout_id = sl.id
       WHERE e.id = $1`,
      [eventId]
    );
    
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const event = eventResult.rows[0];
    
    if (!event.seat_layout_id) {
      return res.status(404).json({ error: 'This event does not have seat selection' });
    }
    
    // Get all seats for this event
    const seatsResult = await db.query(
      `SELECT id, section, row_number, seat_number, seat_label, price, status
       FROM seats
       WHERE event_id = $1
       ORDER BY section, row_number, seat_number`,
      [eventId]
    );
    
    res.json({
      event: {
        id: event.id,
        title: event.title,
      },
      layout: event.layout_config,
      seats: seatsResult.rows,
    });
    
  } catch (error) {
    console.error('Get seats error:', error);
    res.status(500).json({ error: 'Failed to fetch seats' });
  }
});

/**
 * POST /api/seats/reserve
 * Reserve seats (temporary reservation with 5 min expiry)
 */
router.post('/reserve', authenticateToken, async (req, res) => {
  const client = await db.getClient();
  const locksAcquired = [];
  
  try {
    const { eventId, seatIds } = req.body;
    const userId = req.user.userId;
    
    // Validation
    if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ error: 'Please select at least one seat' });
    }
    
    if (seatIds.length > RESERVATION_SETTINGS.MAX_SEATS_PER_RESERVATION) {
      return res.status(400).json({ 
        error: `최대 ${RESERVATION_SETTINGS.MAX_SEATS_PER_RESERVATION}석까지 선택 가능합니다.` 
      });
    }
    
    await client.query('BEGIN');
    
    // Acquire locks for all seats
    for (const seatId of seatIds) {
      const lockKey = LOCK_KEYS.SEAT(eventId, seatId);
      const locked = await acquireLock(lockKey, LOCK_SETTINGS.SEAT_LOCK_TTL);
      
      if (!locked) {
        throw new Error(ERROR_MESSAGES.SEAT_LOCKED);
      }
      
      locksAcquired.push(lockKey);
    }
    
    // Check all seats are available
    const seatsResult = await client.query(
      `SELECT id, seat_label, price, status
       FROM seats
       WHERE id = ANY($1) AND event_id = $2
       FOR UPDATE`,
      [seatIds, eventId]
    );
    
    if (seatsResult.rows.length !== seatIds.length) {
      throw new Error(ERROR_MESSAGES.SEAT_NOT_FOUND);
    }
    
    // Check if any seat is not available
    const unavailableSeats = seatsResult.rows.filter(
      seat => seat.status !== SEAT_STATUS.AVAILABLE
    );
    
    if (unavailableSeats.length > 0) {
      const labels = unavailableSeats.map(s => s.seat_label).join(', ');
      throw new Error(`${ERROR_MESSAGES.SEAT_ALREADY_RESERVED} (${labels})`);
    }
    
    // Calculate total amount
    const totalAmount = seatsResult.rows.reduce((sum, seat) => sum + seat.price, 0);
    
    // Set seats to locked status
    await client.query(
      `UPDATE seats
       SET status = $1, updated_at = NOW()
       WHERE id = ANY($2)`,
      [SEAT_STATUS.LOCKED, seatIds]
    );
    
    // Calculate expiry time (5 minutes from now)
    const expiresAt = new Date(Date.now() + RESERVATION_SETTINGS.TEMPORARY_RESERVATION_MINUTES * 60 * 1000);
    
    // Generate reservation number
    const reservationNumber = `TK${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    
    // Create reservation
    const reservationResult = await client.query(
      `INSERT INTO reservations (
        user_id, event_id, reservation_number, total_amount,
        status, payment_status, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id`,
      [
        userId,
        eventId,
        reservationNumber,
        totalAmount,
        RESERVATION_STATUS.PENDING,
        PAYMENT_STATUS.PENDING,
        expiresAt,
      ]
    );
    
    const reservationId = reservationResult.rows[0].id;
    
    // Create reservation items
    for (const seat of seatsResult.rows) {
      await client.query(
        `INSERT INTO reservation_items (
          reservation_id, ticket_type_id, quantity, unit_price, subtotal, seat_id
        ) VALUES ($1, NULL, 1, $2, $2, $3)`,
        [reservationId, seat.price, seat.id]
      );
    }
    
    await client.query('COMMIT');
    
    // Release all locks
    for (const lockKey of locksAcquired) {
      await releaseLock(lockKey);
    }
    
    // Invalidate cache (좌석 상태 변경 반영)
    try {
      await redisClient.del(CACHE_KEYS.EVENT(eventId));
      await redisClient.del(CACHE_KEYS.SEATS(eventId));
    } catch (cacheError) {
      console.error('⚠️  캐시 삭제 중 에러:', cacheError.message);
    }
    
    res.status(201).json({
      message: SUCCESS_MESSAGES.SEAT_RESERVED,
      reservation: {
        id: reservationId,
        reservationNumber,
        totalAmount,
        expiresAt,
        seats: seatsResult.rows,
      },
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    
    // Release all locks
    for (const lockKey of locksAcquired) {
      await releaseLock(lockKey);
    }
    
    console.error('Reserve seats error:', error);
    res.status(400).json({ error: error.message || 'Failed to reserve seats' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/seats/reservation/:reservationId
 * Get reservation details with seats
 */
router.get('/reservation/:reservationId', authenticateToken, async (req, res) => {
  try {
    const { reservationId } = req.params;
    const userId = req.user.userId;
    
    const result = await db.query(
      `SELECT 
        r.id, r.reservation_number, r.total_amount, r.status,
        r.payment_status, r.payment_method, r.expires_at, r.created_at,
        e.id as event_id, e.title as event_title, e.venue, e.event_date,
        json_agg(
          json_build_object(
            'seatId', s.id,
            'seatLabel', s.seat_label,
            'section', s.section,
            'rowNumber', s.row_number,
            'seatNumber', s.seat_number,
            'price', ri.unit_price
          )
        ) as seats
      FROM reservations r
      JOIN events e ON r.event_id = e.id
      JOIN reservation_items ri ON r.id = ri.reservation_id
      LEFT JOIN seats s ON ri.seat_id = s.id
      WHERE r.id = $1 AND r.user_id = $2
      GROUP BY r.id, e.id`,
      [reservationId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: ERROR_MESSAGES.RESERVATION_NOT_FOUND });
    }
    
    const reservation = result.rows[0];
    
    // Check if expired
    if (reservation.expires_at && new Date(reservation.expires_at) < new Date()) {
      reservation.isExpired = true;
    }
    
    res.json({ reservation });
    
  } catch (error) {
    console.error('Get reservation error:', error);
    res.status(500).json({ error: 'Failed to fetch reservation' });
  }
});

module.exports = router;

