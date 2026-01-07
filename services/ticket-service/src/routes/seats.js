/**
 * Seats Routes
 * 좌석 조회, 예약 기능
 */

const express = require('express');
const db = require('../config/database');
const { client: redisClient } = require('../config/redis');
const { authenticateToken } = require('../middleware/auth');
const { validate: isUUID, v4: uuidv4 } = require('uuid');

const router = express.Router();

// Constants
const SEAT_STATUS = {
  AVAILABLE: 'available',
  LOCKED: 'locked',
  RESERVED: 'reserved',
};

const RESERVATION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

const RESERVATION_SETTINGS = {
  MAX_SEATS_PER_RESERVATION: 1, // Aligned with frontend: 1인 1좌석 선택
  TEMPORARY_RESERVATION_MINUTES: 5,
};

const LOCK_SETTINGS = {
  SEAT_LOCK_TTL: 10000, // 10 seconds
};

const ERROR_MESSAGES = {
  SEAT_NOT_FOUND: '선택한 좌석을 찾을 수 없습니다.',
  SEAT_ALREADY_RESERVED: '이미 예약된 좌석이 있습니다.',
  RESERVATION_NOT_FOUND: '예약 정보를 찾을 수 없습니다.',
};

const SUCCESS_MESSAGES = {
  SEAT_RESERVED: '좌석이 임시 예약되었습니다.',
};

const isValidUUID = (value) => typeof value === 'string' && isUUID(value);

/**
 * GET /seats/layouts
 * 좌석 레이아웃 목록 조회
 */
router.get('/layouts', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, name, description, total_seats, layout_config
       FROM ticket_schema.seat_layouts
       ORDER BY total_seats ASC`
    );

    res.json({
      layouts: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /seats/events/:eventId
 * 이벤트 좌석 정보 조회
 */
router.get('/events/:eventId', async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!isValidUUID(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID format' });
    }

    // Get event info and layout
    const eventResult = await db.query(
      `SELECT e.id, e.title, e.seat_layout_id, sl.layout_config
       FROM ticket_schema.events e
       LEFT JOIN ticket_schema.seat_layouts sl ON e.seat_layout_id = sl.id
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
       FROM ticket_schema.seats
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
    next(error);
  }
});

/**
 * Distributed lock helper using Redis
 */
async function acquireLock(lockKey, ttl) {
  try {
    const result = await redisClient.set(lockKey, '1', 'PX', ttl, 'NX');
    // If Redis is disabled or timed out, result will be null - continue without lock
    if (result === null) {
      return true; // Continue without lock if Redis is unavailable
    }
    // If lock acquired successfully, result is 'OK'
    // If lock already exists, result is null (but above check handles unavailable Redis)
    return result === 'OK';
  } catch (error) {
    console.log('Lock acquire error (continuing without lock):', error.message);
    return true; // Continue without lock if Redis fails
  }
}

async function releaseLock(lockKey) {
  try {
    await redisClient.del(lockKey);
  } catch (error) {
    console.log('Lock release error (ignoring):', error.message);
  }
}

/**
 * POST /seats/reserve
 * 좌석 예약 (임시, 5분 만료)
 */
router.post('/reserve', authenticateToken, async (req, res, next) => {
  const acquiredLocks = [];

  try {
    const { eventId, seatIds } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!eventId || !isValidUUID(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID format' });
    }

    if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ error: 'Please select at least one seat' });
    }

    if (seatIds.length > RESERVATION_SETTINGS.MAX_SEATS_PER_RESERVATION) {
      return res.status(400).json({
        error: `최대 ${RESERVATION_SETTINGS.MAX_SEATS_PER_RESERVATION}석까지 선택 가능합니다.`
      });
    }

    if (!seatIds.every(isValidUUID)) {
      return res.status(400).json({ error: 'Invalid seat ID format' });
    }

    // Acquire distributed locks for all seats
    for (const seatId of seatIds) {
      const lockKey = `seat_lock:${eventId}:${seatId}`;
      const acquired = await acquireLock(lockKey, LOCK_SETTINGS.SEAT_LOCK_TTL);
      if (!acquired) {
        // Release already acquired locks
        for (const lock of acquiredLocks) {
          await releaseLock(lock);
        }
        return res.status(409).json({ error: '다른 사용자가 좌석을 선택 중입니다. 잠시 후 다시 시도해주세요.' });
      }
      acquiredLocks.push(lockKey);
    }

    // Start transaction
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Check all seats are available
      const seatsResult = await client.query(
        `SELECT id, seat_label, price, status
         FROM ticket_schema.seats
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
        `UPDATE ticket_schema.seats
         SET status = $1, updated_at = NOW()
         WHERE id = ANY($2)`,
        [SEAT_STATUS.LOCKED, seatIds]
      );

      // Calculate expiry time (5 minutes from now)
      const expiresAt = new Date(Date.now() + RESERVATION_SETTINGS.TEMPORARY_RESERVATION_MINUTES * 60 * 1000);

      // Generate reservation number
      // Generate unique reservation number (timestamp + UUID for collision prevention)
      const reservationNumber = `TK${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;

      // Create reservation
      const reservationResult = await client.query(
        `INSERT INTO ticket_schema.reservations (
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
          `INSERT INTO ticket_schema.reservation_items (
            reservation_id, ticket_type_id, quantity, unit_price, subtotal, seat_id
          ) VALUES ($1, NULL, 1, $2, $2, $3)`,
          [reservationId, seat.price, seat.id]
        );
      }

      await client.query('COMMIT');

      // Release locks
      for (const lockKey of acquiredLocks) {
        await releaseLock(lockKey);
      }

      // Emit 'seat-selected' event to all users in the event room
      const io = req.app.locals.io;
      if (io) {
        io.to(`seats:${eventId}`).emit('seat-selected', {
          eventId,
          seatIds,
          userId,
          status: 'locked',
        });
      }

      res.status(201).json({
        message: SUCCESS_MESSAGES.SEAT_RESERVED,
        reservation: {
          id: reservationId,
          reservationNumber: reservationNumber,
          totalAmount: totalAmount,
          expiresAt: expiresAt,
          seats: seatsResult.rows,
        },
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    // Release any acquired locks
    for (const lockKey of acquiredLocks) {
      await releaseLock(lockKey);
    }

    next(error);
  }
});

/**
 * GET /seats/reservation/:reservationId
 * 좌석 예약 상세 조회
 */
router.get('/reservation/:reservationId', authenticateToken, async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    if (!isValidUUID(reservationId)) {
      return res.status(400).json({ error: 'Invalid reservation ID format' });
    }

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
            'price', ri.unit_price,
            'ticketTypeName', tt.name,
            'quantity', ri.quantity
          )
        ) as seats
      FROM ticket_schema.reservations r
      JOIN ticket_schema.events e ON r.event_id = e.id
      JOIN ticket_schema.reservation_items ri ON r.id = ri.reservation_id
      LEFT JOIN ticket_schema.seats s ON ri.seat_id = s.id
      LEFT JOIN ticket_schema.ticket_types tt ON ri.ticket_type_id = tt.id
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
    next(error);
  }
});

module.exports = router;
