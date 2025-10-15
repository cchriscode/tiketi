const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { acquireLock, releaseLock, client: redisClient } = require('../config/redis');
const { authenticateToken } = require('../middleware/auth');
const {
  RESERVATION_STATUS,
  PAYMENT_STATUS,
  SEAT_STATUS,
  LOCK_KEYS,
  LOCK_SETTINGS,
  CACHE_KEYS,
} = require('../shared/constants');

const router = express.Router();

// 예매하기 (분산 락 사용)
router.post('/', authenticateToken, async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { eventId, items } = req.body; // items: [{ ticketTypeId, quantity }]
    const userId = req.user.userId;

    // Validate input
    if (!items || items.length === 0) {
      return res.status(400).json({ error: '티켓을 선택해주세요.' });
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

      // Release all locks
      for (const lockKey of locksAcquired) {
        await releaseLock(lockKey);
      }

      // Invalidate cache (이벤트 상세 캐시 삭제 - 재고 변동 반영)
      try {
        await redisClient.del(CACHE_KEYS.EVENT(eventId));
      } catch (cacheError) {
        console.error('⚠️  캐시 삭제 중 에러:', cacheError.message);
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
      
      // Release all locks
      for (const lockKey of locksAcquired) {
        await releaseLock(lockKey);
      }

      throw error;
    }

  } catch (error) {
    console.error('Create reservation error:', error);
    res.status(400).json({ error: error.message || '예매에 실패했습니다.' });
  } finally {
    client.release();
  }
});

// 내 예매 목록 조회
router.get('/my', authenticateToken, async (req, res) => {
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
    console.error('Get my reservations error:', error);
    res.status(500).json({ error: '예매 내역을 불러오는데 실패했습니다.' });
  }
});

// 예매 상세 조회
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
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
    console.error('Get reservation detail error:', error);
    res.status(500).json({ error: '예매 정보를 불러오는데 실패했습니다.' });
  }
});

// 예매 취소
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  const client = await db.getClient();

  try {
    const { id } = req.params;
    const userId = req.user.userId;

    await client.query('BEGIN');

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

    await client.query('COMMIT');

    // Invalidate cache (재고 변동 반영)
    try {
      await redisClient.del(CACHE_KEYS.EVENT(reservation.event_id));
    } catch (cacheError) {
      console.error('⚠️  캐시 삭제 중 에러:', cacheError.message);
    }

    res.json({ message: '예매가 취소되었습니다.' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cancel reservation error:', error);
    res.status(400).json({ error: error.message || '예매 취소에 실패했습니다.' });
  } finally {
    client.release();
  }
});

module.exports = router;

