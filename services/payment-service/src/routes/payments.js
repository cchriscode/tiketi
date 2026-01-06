/**
 * Payment Routes
 * TossPayments API를 사용한 결제 처리
 */

const express = require('express');
const db = require('../config/database');
const { client: redisClient } = require('../config/redis');
const tossPaymentsService = require('../services/tosspayments');
const { authenticateToken } = require('../middleware/auth');
const { validate: isUUID } = require('uuid');

const router = express.Router();

/**
 * POST /payments/prepare
 * 결제 준비 - orderId 생성 및 DB에 pending 상태로 저장
 */
router.post('/prepare', authenticateToken, async (req, res, next) => {
  try {
    const { reservationId, amount } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!reservationId || !isUUID(reservationId)) {
      return res.status(400).json({ error: 'Valid reservation ID is required' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    // Check if reservation exists and belongs to user
    const reservationResult = await db.query(
      `SELECT id, user_id, event_id, total_amount, status
       FROM ticket_schema.reservations
       WHERE id = $1`,
      [reservationId]
    );

    if (reservationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const reservation = reservationResult.rows[0];

    if (reservation.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (reservation.status !== 'pending') {
      return res.status(400).json({ error: 'Reservation is not pending' });
    }

    // Verify amount matches reservation
    if (amount !== reservation.total_amount) {
      return res.status(400).json({ error: 'Amount mismatch' });
    }

    // Check if payment already exists for this reservation
    const existingPayment = await db.query(
      `SELECT id, order_id, status FROM payment_schema.payments WHERE reservation_id = $1`,
      [reservationId]
    );

    if (existingPayment.rows.length > 0) {
      const payment = existingPayment.rows[0];
      if (payment.status === 'confirmed') {
        return res.status(400).json({ error: 'Payment already confirmed' });
      }

      // Return existing orderId for pending payments
      return res.json({
        orderId: payment.order_id,
        amount,
        clientKey: tossPaymentsService.getClientKey(),
      });
    }

    // Generate new orderId
    const orderId = tossPaymentsService.generateOrderId();

    // Create payment record
    const paymentResult = await db.query(
      `INSERT INTO payment_schema.payments (
        reservation_id, user_id, event_id, order_id, amount, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, order_id`,
      [reservationId, userId, reservation.event_id, orderId, amount, 'pending']
    );

    const payment = paymentResult.rows[0];

    res.status(201).json({
      orderId: payment.order_id,
      amount,
      clientKey: tossPaymentsService.getClientKey(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /payments/confirm
 * 결제 승인 - TossPayments confirm API 호출
 */
router.post('/confirm', authenticateToken, async (req, res, next) => {
  const client = await db.pool.connect();

  try {
    const { paymentKey, orderId, amount } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!paymentKey || !orderId || !amount) {
      return res.status(400).json({ error: 'paymentKey, orderId, and amount are required' });
    }

    await client.query('BEGIN');

    // Get payment record
    const paymentResult = await client.query(
      `SELECT id, reservation_id, user_id, amount, status
       FROM payment_schema.payments
       WHERE order_id = $1
       FOR UPDATE`,
      [orderId]
    );

    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = paymentResult.rows[0];

    // Verify user owns this payment
    if (payment.user_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify amount
    if (payment.amount !== amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Amount mismatch' });
    }

    // Check if already confirmed
    if (payment.status === 'confirmed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payment already confirmed' });
    }

    // 🔥 CRITICAL: Verify reservation is valid BEFORE calling Toss API
    // Use FOR UPDATE to prevent race condition with reservation-cleaner
    const reservationCheck = await client.query(
      `SELECT id, status, payment_status, expires_at, event_id
       FROM ticket_schema.reservations
       WHERE id = $1
       FOR UPDATE`,
      [payment.reservation_id]
    );

    if (reservationCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '예약 정보를 찾을 수 없습니다' });
    }

    const reservation = reservationCheck.rows[0];

    // Check if reservation is already confirmed
    if (reservation.status === 'confirmed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '이미 확정된 예약입니다' });
    }

    // Check if reservation is cancelled
    if (reservation.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '취소된 예약입니다' });
    }

    // Check if reservation has expired
    if (new Date() > new Date(reservation.expires_at)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '예약 시간이 만료되었습니다' });
    }

    // Check if reservation is in pending status
    if (reservation.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `예약 상태가 유효하지 않습니다 (현재: ${reservation.status})` });
    }

    // ✅ Reservation validated - now safe to call TossPayments confirm API
    const confirmResult = await tossPaymentsService.confirmPayment(paymentKey, orderId, amount);

    // Log API call
    await client.query(
      `INSERT INTO payment_schema.payment_logs (
        payment_id, action, endpoint, method, request_body, response_status, response_body, error_code, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        payment.id,
        'confirm',
        '/v1/payments/confirm',
        'POST',
        JSON.stringify({ paymentKey, orderId, amount }),
        confirmResult.success ? 200 : (confirmResult.error?.data?.status || 500),
        JSON.stringify(confirmResult.success ? confirmResult.data : confirmResult.error),
        confirmResult.success ? null : confirmResult.error.code,
        confirmResult.success ? null : confirmResult.error.message,
      ]
    );

    if (!confirmResult.success) {
      // Update payment status to failed
      await client.query(
        `UPDATE payment_schema.payments
         SET status = $1, payment_key = $2, updated_at = NOW()
         WHERE id = $3`,
        ['failed', paymentKey, payment.id]
      );

      await client.query('COMMIT');

      return res.status(400).json({
        error: 'Payment confirmation failed',
        code: confirmResult.error.code,
        message: confirmResult.error.message,
      });
    }

    // Update payment with TossPayments response
    const tossData = confirmResult.data;

    await client.query(
      `UPDATE payment_schema.payments
       SET
         payment_key = $1,
         method = $2,
         status = $3,
         toss_order_name = $4,
         toss_status = $5,
         toss_requested_at = $6,
         toss_approved_at = $7,
         toss_receipt_url = $8,
         toss_response = $9,
         updated_at = NOW()
       WHERE id = $10`,
      [
        paymentKey,
        tossData.method || 'UNKNOWN',
        'confirmed',
        tossData.orderName,
        tossData.status,
        tossData.requestedAt,
        tossData.approvedAt,
        tossData.receipt?.url,
        JSON.stringify(tossData),
        payment.id,
      ]
    );

    // ✅ Reservation already validated above - proceed to update
    // Update reservation status to confirmed
    await client.query(
      `UPDATE ticket_schema.reservations
       SET status = $1, payment_status = $2, payment_method = $3, updated_at = NOW()
       WHERE id = $4`,
      ['confirmed', 'completed', tossData.method || 'toss', payment.reservation_id]
    );

    // Update seats status from 'locked' to 'reserved'
    await client.query(
      `UPDATE ticket_schema.seats
       SET status = $1, updated_at = NOW()
       WHERE id IN (
         SELECT seat_id FROM ticket_schema.reservation_items
         WHERE reservation_id = $2 AND seat_id IS NOT NULL
       )`,
      ['reserved', payment.reservation_id]
    );

    await client.query('COMMIT');

    try {
      if (reservation.event_id) {
        await redisClient.srem(`active:${reservation.event_id}`, userId);
        await redisClient.zrem(`active:seen:${reservation.event_id}`, userId);
      }
    } catch (redisError) {
      console.log('Redis error (removeActiveUser):', redisError.message);
    }

    res.json({
      success: true,
      payment: {
        orderId,
        paymentKey,
        amount,
        method: tossData.method,
        approvedAt: tossData.approvedAt,
        receiptUrl: tossData.receipt?.url,
      },
    });

  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * GET /payments/order/:orderId
 * 결제 조회 (orderId로)
 */
router.get('/order/:orderId', authenticateToken, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    const result = await db.query(
      `SELECT
        p.id, p.order_id, p.payment_key, p.amount, p.method, p.status,
        p.toss_status, p.toss_approved_at, p.toss_receipt_url,
        p.created_at, p.updated_at,
        r.reservation_number, r.total_amount as reservation_amount
      FROM payment_schema.payments p
      LEFT JOIN ticket_schema.reservations r ON p.reservation_id = r.id
      WHERE p.order_id = $1`,
      [orderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = result.rows[0];

    // Verify ownership
    const ownerCheck = await db.query(
      `SELECT user_id FROM payment_schema.payments WHERE order_id = $1`,
      [orderId]
    );

    if (ownerCheck.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ payment });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /payments/:paymentKey/cancel
 * 결제 취소 (환불)
 */
router.post('/:paymentKey/cancel', authenticateToken, async (req, res, next) => {
  const client = await db.pool.connect();

  try {
    const { paymentKey } = req.params;
    const { cancelReason } = req.body;
    const userId = req.user.userId;

    if (!cancelReason) {
      return res.status(400).json({ error: 'Cancel reason is required' });
    }

    await client.query('BEGIN');

    // Get payment
    const paymentResult = await client.query(
      `SELECT id, user_id, amount, status, event_id
       FROM payment_schema.payments
       WHERE payment_key = $1
       FOR UPDATE`,
      [paymentKey]
    );

    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = paymentResult.rows[0];

    if (payment.user_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }

    if (payment.status !== 'confirmed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only confirmed payments can be cancelled' });
    }

    // Call TossPayments cancel API
    const cancelResult = await tossPaymentsService.cancelPayment(paymentKey, cancelReason);

    // Log API call
    await client.query(
      `INSERT INTO payment_schema.payment_logs (
        payment_id, action, endpoint, method, request_body, response_status, response_body, error_code, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        payment.id,
        'cancel',
        `/v1/payments/${paymentKey}/cancel`,
        'POST',
        JSON.stringify({ cancelReason }),
        cancelResult.success ? 200 : 500,
        JSON.stringify(cancelResult.success ? cancelResult.data : cancelResult.error),
        cancelResult.success ? null : cancelResult.error.code,
        cancelResult.success ? null : cancelResult.error.message,
      ]
    );

    if (!cancelResult.success) {
      await client.query('COMMIT');

      return res.status(400).json({
        error: 'Payment cancellation failed',
        code: cancelResult.error.code,
        message: cancelResult.error.message,
      });
    }

    // Update payment status
    await client.query(
      `UPDATE payment_schema.payments
       SET status = $1, refund_amount = $2, refund_reason = $3, refunded_at = NOW(), updated_at = NOW()
       WHERE id = $4`,
      ['refunded', payment.amount, cancelReason, payment.id]
    );

    await client.query('COMMIT');

    try {
      if (payment.event_id) {
        await redisClient.srem(`active:${payment.event_id}`, userId);
        await redisClient.zrem(`active:seen:${payment.event_id}`, userId);
      }
    } catch (redisError) {
      console.log('Redis error (removeActiveUser):', redisError.message);
    }

    res.json({
      success: true,
      message: 'Payment cancelled successfully',
      refundAmount: payment.amount,
    });

  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * GET /payments/user/me
 * 내 결제 내역 조회
 */
router.get('/user/me', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { limit = 10, offset = 0 } = req.query;

    const result = await db.query(
      `SELECT
        p.id, p.order_id, p.payment_key, p.amount, p.method, p.status,
        p.toss_approved_at, p.created_at,
        r.reservation_number, e.title as event_title
      FROM payment_schema.payments p
      LEFT JOIN ticket_schema.reservations r ON p.reservation_id = r.id
      LEFT JOIN ticket_schema.events e ON p.event_id = e.id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) FROM payment_schema.payments WHERE user_id = $1`,
      [userId]
    );

    res.json({
      payments: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /payments/process
 * Non-Toss 결제 처리 (네이버페이, 카카오페이, 계좌이체 등)
 */
router.post('/process', authenticateToken, async (req, res, next) => {
  const client = await db.pool.connect();

  try {
    const { reservationId, paymentMethod } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!reservationId || !isUUID(reservationId)) {
      return res.status(400).json({ error: 'Valid reservation ID is required' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    const validMethods = ['naver_pay', 'kakao_pay', 'bank_transfer'];
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    await client.query('BEGIN');

    // Get reservation with lock
    const reservationResult = await client.query(
      `SELECT
        r.id, r.user_id, r.reservation_number, r.total_amount, r.status,
        r.payment_status, r.expires_at, r.event_id
      FROM ticket_schema.reservations r
      WHERE r.id = $1
      FOR UPDATE`,
      [reservationId]
    );

    if (reservationResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const reservation = reservationResult.rows[0];

    // Check ownership
    if (reservation.user_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if already paid
    if (reservation.payment_status === 'completed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payment already completed for this reservation' });
    }

    // Check if expired
    if (reservation.expires_at && new Date(reservation.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Reservation has expired' });
    }

    // Simulate payment processing (in real implementation, call actual payment API)
    // For now, just mark as completed

    // Generate order ID
    const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    // Create payment record
    const paymentResult = await client.query(
      `INSERT INTO payment_schema.payments (
        user_id, event_id, reservation_id, order_id, amount, method, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id`,
      [userId, reservation.event_id, reservationId, orderId, reservation.total_amount, paymentMethod, 'confirmed']
    );

    const paymentId = paymentResult.rows[0].id;

    // Update reservation status
    await client.query(
      `UPDATE ticket_schema.reservations
       SET status = $1, payment_status = $2, payment_method = $3, updated_at = NOW()
       WHERE id = $4`,
      ['confirmed', 'completed', paymentMethod, reservationId]
    );

    // Update seats status from 'locked' to 'reserved'
    await client.query(
      `UPDATE ticket_schema.seats
       SET status = $1, updated_at = NOW()
       WHERE id IN (
         SELECT seat_id FROM ticket_schema.reservation_items
         WHERE reservation_id = $2 AND seat_id IS NOT NULL
       )`,
      ['reserved', reservationId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: '결제가 완료되었습니다.',
      payment: {
        id: paymentId,
        orderId,
        amount: reservation.total_amount,
        method: paymentMethod,
        reservationNumber: reservation.reservation_number,
      },
    });

  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
