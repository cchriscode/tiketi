/**
 * Seats Router - Ticket Service
 * Handles seat selection and reservation APIs
 */

const express = require('express');
const db = require('../config/database');
const { logger } = require('../utils/logger');
const { client: redisClient } = require('../config/redis');
const { authenticate } = require('../middleware/auth');
const { emitToSeats } = require('../config/socket');
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
const CustomError = require('../utils/custom-error');
const { validate: isUUID } = require('uuid');

const router = express.Router();

const isValidUUID = (value) => typeof value === 'string' && isUUID(value);

/**
 * @swagger
 * /api/v1/seats/layouts:
 *   get:
 *     summary: 좌석 레이아웃 목록 조회
 *     tags: [Seats]
 *     responses:
 *       200:
 *         description: 좌석 레이아웃 목록
 */
router.get('/layouts', async (req, res, next) => {
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
    next(new CustomError(500, 'Get seat layouts error:', error));
  }
});

/**
 * @swagger
 * /api/v1/seats/events/{eventId}:
 *   get:
 *     summary: 이벤트 좌석 정보 조회
 *     tags: [Seats]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 이벤트 ID
 *     responses:
 *       200:
 *         description: 좌석 정보
 *       404:
 *         description: 이벤트를 찾을 수 없음
 */
router.get('/events/:eventId', async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!isValidUUID(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID format' });
    }

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
    next(new CustomError(500, 'Failed to fetch seats', error));
  }
});

/**
 * @swagger
 * /api/v1/seats/reserve:
 *   post:
 *     summary: 좌석 예약 (임시, 5분 만료)
 *     tags: [Seats]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventId
 *               - seatIds
 *             properties:
 *               eventId:
 *                 type: string
 *                 format: uuid
 *               seatIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: 좌석 예약 성공
 *       400:
 *         description: 잘못된 요청
 */
router.post('/reserve', authenticate, async (req, res, next) => {
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

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

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

      const unavailableSeats = seatsResult.rows.filter(
        seat => seat.status !== SEAT_STATUS.AVAILABLE
      );

      if (unavailableSeats.length > 0) {
        const labels = unavailableSeats.map(s => s.seat_label).join(', ');
        throw new Error(`${ERROR_MESSAGES.SEAT_ALREADY_RESERVED} (${labels})`);
      }

      const totalAmount = seatsResult.rows.reduce((sum, seat) => sum + seat.price, 0);

      // Set seats to locked status
      await client.query(
        `UPDATE seats
         SET status = $1, updated_at = NOW()
         WHERE id = ANY($2)`,
        [SEAT_STATUS.LOCKED, seatIds]
      );

      // Calculate expiry time
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

      // Broadcast seat updates
      try {
        const io = req.app.locals.io;
        if (io) {
          for (const seatId of seatIds) {
            emitToSeats(io, eventId, 'seat-locked', {
              seatId,
              userId,
              status: SEAT_STATUS.LOCKED,
              timestamp: new Date(),
            });
          }
          logger.info(`🪑 Seats locked: ${seatIds.join(', ')} by user ${userId}`);
        }
      } catch (socketError) {
        logger.error('⚠️  WebSocket 브로드캐스트 에러:', socketError.message);
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
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    next(new CustomError(400, error.message || 'Failed to reserve seats', error));
  }
});

/**
 * @swagger
 * /api/v1/seats/reservation/{reservationId}:
 *   get:
 *     summary: 좌석 예약 상세 조회
 *     tags: [Seats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reservationId
 *         required: true
 *         schema:
 *           type: string
 *         description: 예약 ID
 *     responses:
 *       200:
 *         description: 예약 상세 정보
 *       404:
 *         description: 예약을 찾을 수 없음
 */
router.get('/reservation/:reservationId', authenticate, async (req, res, next) => {
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

    if (reservation.expires_at && new Date(reservation.expires_at) < new Date()) {
      reservation.isExpired = true;
    }

    res.json({ reservation });

  } catch (error) {
    next(new CustomError(500, 'Failed to fetch reservation', error));
  }
});

module.exports = router;
