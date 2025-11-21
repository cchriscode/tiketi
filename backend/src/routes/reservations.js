const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { acquireLock, releaseLock, client: redisClient } = require('../config/redis');
const { authenticateToken } = require('../middleware/auth');
const { emitToEvent } = require('../config/socket');
const {
  RESERVATION_STATUS,
  PAYMENT_STATUS,
  SEAT_STATUS,
  LOCK_KEYS,
  LOCK_SETTINGS,
  CACHE_KEYS,
} = require('../shared/constants');
const { invalidateCache, withTransaction } = require('../utils/transaction-helpers');
const { logger } = require('../utils/logger');
const CustomError = require('../utils/custom-error');
const { 
  reservationsCreated, 
  reservationsCancelled,
  conversionFunnel
} = require('../metrics');
const { validate: isUUID } = require('uuid');

const router = express.Router();

const ensureUUID = (value, res, field = 'id') => {
  if (!isUUID(value)) {
    res.status(400).json({ error: `Invalid ${field} format` });
    return false;
  }
  return true;
};

const ensureUUIDArray = (values, res, field = 'id') => {
  if (!Array.isArray(values) || !values.every(v => isUUID(v))) {
    res.status(400).json({ error: `Invalid ${field} list` });
    return false;
  }
  return true;
};

/**
 * @swagger
 * /api/reservations:
 *   post:
 *     summary: 예매하기
 *     tags: [Reservations]
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
 *               - items
 *             properties:
 *               eventId:
 *                 type: string
 *                 format: uuid
 *                 description: 이벤트 ID
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     ticketTypeId:
 *                       type: string
 *                       format: uuid
 *                     quantity:
 *                       type: integer
 *     responses:
 *       201:
 *         description: 예매 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 reservation:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     reservationNumber:
 *                       type: string
 *                     totalAmount:
 *                       type: integer
 *       400:
 *         description: 잘못된 요청
 */
router.post('/', authenticateToken, async (req, res, next) => {
  const client = await db.getClient();

  try {
    const { eventId, items } = req.body; // items: [{ ticketTypeId, quantity }]
    const userId = req.user.userId;

    // Validate input
    if (!eventId || !ensureUUID(eventId, res, 'eventId')) {
      return;
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: '티켓을 선택해주세요.' });
    }

    const ticketIds = items.map(item => item.ticketTypeId).filter(Boolean);
    if (ticketIds.length !== items.length || !ensureUUIDArray(ticketIds, res, 'ticketTypeId')) {
      return;
    }

    // Generate reservation number
    const reservationNumber = `TK${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    let totalAmount = 0;
    const locksAcquired = [];

    // Start transaction
    await client.query('BEGIN');

    try {
      // Process each ticket type
      for (const item of items) {
        const { ticketTypeId, quantity } = item;

        if (quantity <= 0) {
          throw new Error('수량은 1개 이상이어야 합니다.');
        }

        // Acquire distributed lock for this ticket type
        const lockKey = LOCK_KEYS.TICKET(ticketTypeId);
        const locked = await acquireLock(lockKey, LOCK_SETTINGS.TICKET_LOCK_TTL);

        if (!locked) {
          throw new Error('현재 많은 사용자가 예매 중입니다. 잠시 후 다시 시도해주세요.');
        }

        locksAcquired.push(lockKey);

        // Check availability
        const ticketResult = await client.query(
          'SELECT id, price, available_quantity, name FROM ticket_types WHERE id = $1 FOR UPDATE',
          [ticketTypeId]
        );

        if (ticketResult.rows.length === 0) {
          throw new Error('존재하지 않는 티켓입니다.');
        }

        const ticket = ticketResult.rows[0];

        if (ticket.available_quantity < quantity) {
          throw new Error(`${ticket.name} 티켓이 부족합니다. (남은 수량: ${ticket.available_quantity})`);
        }

        // Update available quantity
        await client.query(
          'UPDATE ticket_types SET available_quantity = available_quantity - $1 WHERE id = $2',
          [quantity, ticketTypeId]
        );

        totalAmount += ticket.price * quantity;
      }

      // Create reservation
      const reservationResult = await client.query(
        `INSERT INTO reservations (user_id, event_id, reservation_number, total_amount, status, payment_status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [userId, eventId, reservationNumber, totalAmount, RESERVATION_STATUS.PENDING, PAYMENT_STATUS.PENDING]
      );

      const reservationId = reservationResult.rows[0].id;

      // Create reservation items
      for (const item of items) {
        const { ticketTypeId, quantity } = item;

        const ticketResult = await client.query(
          'SELECT price FROM ticket_types WHERE id = $1',
          [ticketTypeId]
        );
        const unitPrice = ticketResult.rows[0].price;
        const subtotal = unitPrice * quantity;

        await client.query(
          `INSERT INTO reservation_items (reservation_id, ticket_type_id, quantity, unit_price, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [reservationId, ticketTypeId, quantity, unitPrice, subtotal]
        );
      }

      // Commit transaction
      await client.query('COMMIT');

      // 메트릭 추가: 예약 생성 성공
      reservationsCreated.labels(eventId, 'success').inc();
      conversionFunnel.labels('reservation_created', eventId).inc();

      // Release all locks
      for (const lockKey of locksAcquired) {
        await releaseLock(lockKey);
      }

      // Invalidate cache (이벤트 상세 캐시 삭제 - 재고 변동 반영)
      await invalidateCache(redisClient, CACHE_KEYS.EVENT(eventId));

      // 실시간 티켓 재고 업데이트 브로드캐스트
      try {
        const io = req.app.locals.io;
        if (io) {
          // 변경된 티켓 타입들의 최신 재고 정보 조회
          for (const item of items) {
            const ticketResult = await db.query(
              'SELECT id, available_quantity, total_quantity FROM ticket_types WHERE id = $1',
              [item.ticketTypeId]
            );

            if (ticketResult.rows.length > 0) {
              const ticket = ticketResult.rows[0];

              // 해당 이벤트를 보고 있는 모든 사용자에게 실시간 알림
              emitToEvent(io, eventId, 'ticket-updated', {
                ticketTypeId: ticket.id,
                availableQuantity: ticket.available_quantity,
                totalQuantity: ticket.total_quantity,
                timestamp: new Date(),
              });
            }
          }
        }
      } catch (socketError) {
        logger.error('⚠️  WebSocket 브로드캐스트 에러:', socketError.message);
      }

      res.status(201).json({
        message: '예매가 완료되었습니다.',
        reservation: {
          id: reservationId,
          reservationNumber,
          totalAmount,
        }
      });

    } catch (error) {
      // Rollback transaction
      await client.query('ROLLBACK');

      // 메트릭 추가: 예약 생성 실패
      if (eventId) {
      reservationsCreated.labels(eventId, 'failed').inc();
      }

      // Release all locks
      for (const lockKey of locksAcquired) {
        await releaseLock(lockKey);
      }

      throw error;
    }

  } catch (error) {
    next(new CustomError(400, error.message || '예매에 실패했습니다.', error));
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /api/reservations/my:
 *   get:
 *     summary: 내 예매 목록 조회
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 예매 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reservations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Reservation'
 */
router.get('/my', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const result = await db.query(
      `SELECT 
        r.id, r.reservation_number, r.total_amount, r.status, r.payment_status,
        r.created_at,
        e.title as event_title, e.venue, e.event_date,
        json_agg(
          json_build_object(
            'ticketTypeName', COALESCE(tt.name, s.seat_label),
            'quantity', COALESCE(ri.quantity, 1),
            'unitPrice', ri.unit_price,
            'subtotal', ri.subtotal
          )
        ) as items
      FROM reservations r
      JOIN events e ON r.event_id = e.id
      JOIN reservation_items ri ON r.id = ri.reservation_id
      LEFT JOIN ticket_types tt ON ri.ticket_type_id = tt.id
      LEFT JOIN seats s ON ri.seat_id = s.id
      WHERE r.user_id = $1
      GROUP BY r.id, e.id
      ORDER BY r.created_at DESC`,
      [userId]
    );

    res.json({ reservations: result.rows });
  } catch (error) {
    next(new CustomError(500, '예매 내역을 불러오는데 실패했습니다.', error));
  }
});

/**
 * @swagger
 * /api/reservations/{id}:
 *   get:
 *     summary: 예매 상세 조회
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 예매 ID
 *     responses:
 *       200:
 *         description: 예매 상세 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reservation:
 *                   $ref: '#/components/schemas/Reservation'
 *       404:
 *         description: 예매 내역을 찾을 수 없음
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ensureUUID(id, res)) return;

    const userId = req.user.userId;

    const result = await db.query(
      `SELECT 
        r.id, r.reservation_number, r.total_amount, r.status, r.payment_status,
        r.payment_method, r.created_at,
        e.id as event_id, e.title as event_title, e.venue, e.event_date, e.address,
        json_agg(
          json_build_object(
            'ticketTypeName', COALESCE(tt.name, s.seat_label),
            'quantity', COALESCE(ri.quantity, 1),
            'unitPrice', ri.unit_price,
            'subtotal', ri.subtotal,
            'seatLabel', s.seat_label,
            'section', s.section
          )
        ) as items
      FROM reservations r
      JOIN events e ON r.event_id = e.id
      JOIN reservation_items ri ON r.id = ri.reservation_id
      LEFT JOIN ticket_types tt ON ri.ticket_type_id = tt.id
      LEFT JOIN seats s ON ri.seat_id = s.id
      WHERE r.id = $1 AND r.user_id = $2
      GROUP BY r.id, e.id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '예매 내역을 찾을 수 없습니다.' });
    }

    res.json({ reservation: result.rows[0] });
  } catch (error) {
    next(new CustomError(500, '예매 정보를 불러오는데 실패했습니다.', error));
  }
});

/**
 * @swagger
 * /api/reservations/{id}/cancel:
 *   post:
 *     summary: 예매 취소
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 예매 ID
 *     responses:
 *       200:
 *         description: 예매 취소 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: 잘못된 요청
 */
router.post('/:id/cancel', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ensureUUID(id, res)) return;

    const userId = req.user.userId;

    const result = await withTransaction(async (client) => {
      // Get reservation
      const reservationResult = await client.query(
        'SELECT id, status, event_id FROM reservations WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [id, userId]
      );

      if (reservationResult.rows.length === 0) {
        throw new Error('예매 내역을 찾을 수 없습니다.');
      }

      const reservation = reservationResult.rows[0];

      if (reservation.status === RESERVATION_STATUS.CANCELLED) {
        throw new Error('이미 취소된 예매입니다.');
      }

      // Get reservation items
      const itemsResult = await client.query(
        'SELECT ticket_type_id, quantity, seat_id FROM reservation_items WHERE reservation_id = $1',
        [id]
      );

      // Restore ticket quantities and seats
      for (const item of itemsResult.rows) {
        // Restore ticket quantity if ticket-based
        if (item.ticket_type_id) {
          await client.query(
            'UPDATE ticket_types SET available_quantity = available_quantity + $1 WHERE id = $2',
            [item.quantity, item.ticket_type_id]
          );
        }

        // Restore seat status if seat-based
        if (item.seat_id) {
          await client.query(
            `UPDATE seats SET status = $1, updated_at = NOW() WHERE id = $2`,
            [SEAT_STATUS.AVAILABLE, item.seat_id]
          );
        }
      }

      // Update reservation status
      await client.query(
        `UPDATE reservations
         SET status = $1, payment_status = $2
         WHERE id = $3`,
        [RESERVATION_STATUS.CANCELLED, PAYMENT_STATUS.REFUNDED, id]
      );

      // 메트릭 추가: 예약 취소
      reservationsCancelled.labels(reservation.event_id, 'user_cancel').inc();

      // 메트릭 추가: 좌석 해제 (좌석 기반 예약인 경우)
      const seatCount = itemsResult.rows.filter(item => item.seat_id).length;
      if (seatCount > 0) {
        seatsReserved.labels(reservation.event_id).dec(seatCount);
        seatsAvailable.labels(reservation.event_id).inc(seatCount);
      }

      return { reservation, items: itemsResult.rows };
    });

    // Invalidate cache (재고 변동 반영)
    await invalidateCache(redisClient, CACHE_KEYS.EVENT(result.reservation.event_id));

    // 실시간 티켓 재고 업데이트 브로드캐스트 (취소로 인한 재고 증가)
    try {
      const io = req.app.locals.io;
      if (io) {
        for (const item of result.items) {
          if (item.ticket_type_id) {
            const ticketResult = await db.query(
              'SELECT id, available_quantity, total_quantity FROM ticket_types WHERE id = $1',
              [item.ticket_type_id]
            );

            if (ticketResult.rows.length > 0) {
              const ticket = ticketResult.rows[0];

              emitToEvent(io, result.reservation.event_id, 'ticket-updated', {
                ticketTypeId: ticket.id,
                availableQuantity: ticket.available_quantity,
                totalQuantity: ticket.total_quantity,
                timestamp: new Date(),
              });
            }
          }
        }
      }
    } catch (socketError) {
      logger.error('⚠️  WebSocket 브로드캐스트 에러:', socketError.message);
    }

    res.json({ message: '예매가 취소되었습니다.' });

  } catch (error) {
    next(new CustomError(400, error.message || '예매 취소에 실패했습니다.', error));
  }
}); module.exports = router;

