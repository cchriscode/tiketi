/**
 * Reservations Routes
 * 예약 조회, 취소 기능
 */

const express = require('express');
const db = require('../config/database');
const { client: redisClient } = require('../config/redis');
const { authenticateToken } = require('../middleware/auth');
const { NotFoundError, ConflictError, ValidationError } = require('@tiketi/common');
const { validate: isUUID, v4: uuidv4 } = require('uuid');

const router = express.Router();

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

const SEAT_STATUS = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  LOCKED: 'locked',
};

const ERROR_MESSAGES = {
  INVALID_UUID: 'Invalid ID format',
  RESERVATION_NOT_FOUND: '예약 정보를 찾을 수 없습니다.',
  ALREADY_CANCELLED: '이미 취소된 예약입니다.',
};

const isValidUUID = (value) => typeof value === 'string' && isUUID(value);

/**
 * POST /reservations
 * 예약 생성 (티켓 타입 기반 - 비좌석 이벤트용)
 */
router.post('/', authenticateToken, async (req, res, next) => {
  let client;

  try {
    client = await db.pool.connect();
    const { eventId, items } = req.body; // items: [{ ticketTypeId, quantity }]
    const userId = req.user.userId;

    if (!eventId || !items || items.length === 0) {
      return res.status(400).json({ error: '이벤트와 티켓 정보가 필요합니다.' });
    }

    await client.query('BEGIN');

    // Get event details
    const eventResult = await client.query(
      'SELECT id, title FROM ticket_schema.events WHERE id = $1',
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      throw new Error('이벤트를 찾을 수 없습니다.');
    }

    const event = eventResult.rows[0];

    // Calculate total amount and validate ticket availability
    let totalAmount = 0;
    const reservationItems = [];

    for (const item of items) {
      const { ticketTypeId, quantity } = item;

      // Get ticket type details
      const ticketResult = await client.query(
        `SELECT id, name, price, available_quantity
         FROM ticket_schema.ticket_types
         WHERE id = $1 AND event_id = $2 FOR UPDATE`,
        [ticketTypeId, eventId]
      );

      if (ticketResult.rows.length === 0) {
        throw new Error(`티켓 타입을 찾을 수 없습니다: ${ticketTypeId}`);
      }

      const ticket = ticketResult.rows[0];

      if (ticket.available_quantity < quantity) {
        throw new Error(`${ticket.name} 티켓의 재고가 부족합니다.`);
      }

      // Update available quantity
      await client.query(
        'UPDATE ticket_schema.ticket_types SET available_quantity = available_quantity - $1 WHERE id = $2',
        [quantity, ticketTypeId]
      );

      const subtotal = ticket.price * quantity;
      totalAmount += subtotal;

      reservationItems.push({
        ticketTypeId: ticket.id,
        ticketTypeName: ticket.name,
        quantity,
        unitPrice: ticket.price,
        subtotal,
      });
    }

    // Create reservation with unique number (timestamp + short UUID for collision prevention)
    const reservationNumber = `R${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const reservationResult = await client.query(
      `INSERT INTO ticket_schema.reservations
       (user_id, event_id, reservation_number, total_amount, status, payment_status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, reservation_number, total_amount, status, payment_status, expires_at`,
      [userId, eventId, reservationNumber, totalAmount, RESERVATION_STATUS.PENDING, PAYMENT_STATUS.PENDING, expiresAt]
    );

    const reservation = reservationResult.rows[0];

    // Create reservation items
    for (const item of reservationItems) {
      await client.query(
        `INSERT INTO ticket_schema.reservation_items
         (reservation_id, ticket_type_id, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [reservation.id, item.ticketTypeId, item.quantity, item.unitPrice, item.subtotal]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: '예약이 생성되었습니다.',
      reservation: {
        id: reservation.id,
        reservationNumber: reservation.reservation_number,
        eventTitle: event.title,
        totalAmount: reservation.total_amount,
        status: reservation.status,
        paymentStatus: reservation.payment_status,
        expiresAt: reservation.expires_at,
        items: reservationItems,
      },
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    next(error);
  } finally {
    if (client) client.release();
  }
});

/**
 * GET /reservations/my
 * 내 예약 목록 조회
 */
router.get('/my', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const result = await db.query(
      `SELECT
        r.id, r.reservation_number, r.total_amount, r.status, r.payment_status,
        r.created_at, r.expires_at,
        e.title as event_title, e.venue, e.event_date,
        json_agg(
          json_build_object(
            'ticketTypeName', COALESCE(tt.name, s.seat_label),
            'quantity', COALESCE(ri.quantity, 1),
            'unitPrice', ri.unit_price,
            'subtotal', ri.subtotal,
            'seatLabel', s.seat_label
          )
        ) as items
      FROM ticket_schema.reservations r
      LEFT JOIN ticket_schema.events e ON r.event_id = e.id
      JOIN ticket_schema.reservation_items ri ON r.id = ri.reservation_id
      LEFT JOIN ticket_schema.ticket_types tt ON ri.ticket_type_id = tt.id
      LEFT JOIN ticket_schema.seats s ON ri.seat_id = s.id
      WHERE r.user_id = $1
      GROUP BY r.id, e.id
      ORDER BY r.created_at DESC`,
      [userId]
    );

    res.json({ reservations: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /reservations/:id
 * 예약 상세 조회
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: ERROR_MESSAGES.INVALID_UUID });
    }

    const userId = req.user.userId;

    const result = await db.query(
      `SELECT
        r.id, r.reservation_number, r.total_amount, r.status,
        r.payment_status, r.payment_method, r.expires_at, r.created_at,
        e.id as event_id, e.title as event_title, e.venue, e.address, e.event_date,
        json_agg(
          json_build_object(
            'ticketTypeName', COALESCE(tt.name, s.seat_label),
            'quantity', COALESCE(ri.quantity, 1),
            'unitPrice', ri.unit_price,
            'subtotal', ri.subtotal,
            'seatId', s.id,
            'seatLabel', s.seat_label,
            'section', s.section,
            'rowNumber', s.row_number,
            'seatNumber', s.seat_number
          )
        ) as items
      FROM ticket_schema.reservations r
      JOIN ticket_schema.events e ON r.event_id = e.id
      JOIN ticket_schema.reservation_items ri ON r.id = ri.reservation_id
      LEFT JOIN ticket_schema.ticket_types tt ON ri.ticket_type_id = tt.id
      LEFT JOIN ticket_schema.seats s ON ri.seat_id = s.id
      WHERE r.id = $1 AND r.user_id = $2
      GROUP BY r.id, e.id`,
      [id, userId]
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

/**
 * POST /reservations/:id/cancel
 * 예약 취소
 */
router.post('/:id/cancel', authenticateToken, async (req, res, next) => {
  let client;

  try {
    const { id } = req.params;
    if (!isValidUUID(id)) {
      throw new ValidationError(ERROR_MESSAGES.INVALID_UUID);
    }

    client = await db.pool.connect();
    const userId = req.user.userId;

    await client.query('BEGIN');

    // Get reservation with lock
    const reservationResult = await client.query(
      'SELECT id, status, event_id FROM ticket_schema.reservations WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [id, userId]
    );

    if (reservationResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new NotFoundError(ERROR_MESSAGES.RESERVATION_NOT_FOUND);
    }

    const reservation = reservationResult.rows[0];

    if (reservation.status === RESERVATION_STATUS.CANCELLED) {
      await client.query('ROLLBACK');
      throw new ConflictError(ERROR_MESSAGES.ALREADY_CANCELLED);
    }

    // Get reservation items
    const itemsResult = await client.query(
      'SELECT ticket_type_id, quantity, seat_id FROM ticket_schema.reservation_items WHERE reservation_id = $1',
      [id]
    );

    // Restore ticket quantities and seats
    for (const item of itemsResult.rows) {
      // Restore ticket quantity if ticket-based
      if (item.ticket_type_id) {
        await client.query(
          'UPDATE ticket_schema.ticket_types SET available_quantity = available_quantity + $1 WHERE id = $2',
          [item.quantity, item.ticket_type_id]
        );
      }

      // Restore seat status if seat-based
      if (item.seat_id) {
        await client.query(
          `UPDATE ticket_schema.seats SET status = $1, updated_at = NOW() WHERE id = $2`,
          [SEAT_STATUS.AVAILABLE, item.seat_id]
        );
      }
    }

    // Update reservation status
    await client.query(
      `UPDATE ticket_schema.reservations
       SET status = $1, payment_status = $2, updated_at = NOW()
       WHERE id = $3`,
      [RESERVATION_STATUS.CANCELLED, PAYMENT_STATUS.REFUNDED, id]
    );

    await client.query('COMMIT');

    try {
      await redisClient.srem(`active:${reservation.event_id}`, userId);
      await redisClient.zrem(`active:seen:${reservation.event_id}`, userId);
    } catch (redisError) {
      console.log('Redis error (removeActiveUser):', redisError.message);
    }

    // Send success response (connection released in finally)
    return res.status(200).json({
      message: '예약이 취소되었습니다.',
      reservation: {
        id,
        status: RESERVATION_STATUS.CANCELLED,
      },
    });
  } catch (error) {
    // Rollback transaction if error occurred
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }
    next(error);
  } finally {
    // Always release connection
    if (client) {
      client.release();
    }
  }
});

module.exports = router;
