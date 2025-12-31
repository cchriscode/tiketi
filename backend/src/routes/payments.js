/**
 * Payments Router
 * Handles payment processing (mock implementation)
 */

const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const {
  SEAT_STATUS,
  RESERVATION_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  PAYMENT_SETTINGS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} = require('../shared/constants');
const { withTransaction } = require('../utils/transaction-helpers');
const { logger } = require('../utils/logger');
const CustomError = require('../utils/custom-error');
const { 
  paymentsTotal, 
  paymentAmount,
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

/**
 * @swagger
 * /api/payments/process:
 *   post:
 *     summary: 결제 처리
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reservationId
 *               - paymentMethod
 *             properties:
 *               reservationId:
 *                 type: string
 *                 format: uuid
 *                 description: 예약 ID
 *               paymentMethod:
 *                 type: string
 *                 enum: [naver_pay, kakao_pay, bank_transfer]
 *                 description: 결제 수단
 *     responses:
 *       200:
 *         description: 결제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 payment:
 *                   type: object
 *       400:
 *         description: 잘못된 요청
 */
router.post('/process', authenticateToken, async (req, res, next) => {
  try {
    const { reservationId, paymentMethod } = req.body;
    let eventId = null;
    const userId = req.user.userId;

    // Validation
    if (!reservationId || !paymentMethod) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!ensureUUID(reservationId, res, 'reservationId')) {
      return;
    }

    const validMethods = Object.values(PAYMENT_METHODS);
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: ERROR_MESSAGES.INVALID_PAYMENT_METHOD });
    }

    const result = await withTransaction(async (client) => {
      // Get reservation
      const reservationResult = await client.query(
        `SELECT
          r.id, r.reservation_number, r.total_amount, r.status,
          r.payment_status, r.expires_at, r.event_id
        FROM reservations r
        WHERE r.id = $1 AND r.user_id = $2
        FOR UPDATE`,
        [reservationId, userId]
      );

      if (reservationResult.rows.length === 0) {
        throw new Error(ERROR_MESSAGES.RESERVATION_NOT_FOUND);
      }

      const reservation = reservationResult.rows[0];
      // eventId 저장 (에러 핸들러에서 사용하기 위해)
      eventId = reservation.event_id;

      // Check if already paid
      if (reservation.payment_status === PAYMENT_STATUS.COMPLETED) {
        throw new Error('Payment already completed for this reservation');
      }

      // Check if expired
      if (reservation.expires_at && new Date(reservation.expires_at) < new Date()) {
        throw new Error(ERROR_MESSAGES.RESERVATION_EXPIRED);
      }

      // Simulate payment processing delay
      await simulatePaymentProcessing(paymentMethod);

      // Update reservation status
      await client.query(
        `UPDATE reservations
         SET
          status = $1,
          payment_status = $2,
          payment_method = $3,
          updated_at = NOW()
         WHERE id = $4`,
        [
          RESERVATION_STATUS.CONFIRMED,
          PAYMENT_STATUS.COMPLETED,
          paymentMethod,
          reservationId,
        ]
      );

      // 메트릭 추가: 결제 성공
      paymentsTotal.labels({
        status: 'success',
        event_id: reservation.event_id,
        payment_method: paymentMethod
      }).inc();
      paymentAmount.labels(reservation.event_id).observe(reservation.total_amount);
      conversionFunnel.labels('payment_completed', reservation.event_id).inc();

      // Update seats status to reserved
      await client.query(
        `UPDATE seats
         SET status = $1, updated_at = NOW()
         WHERE id IN (
           SELECT seat_id FROM reservation_items
           WHERE reservation_id = $2 AND seat_id IS NOT NULL
         )`,
        [SEAT_STATUS.RESERVED, reservationId]
      );

      // Get seat details for response
      const seatsResult = await client.query(
        `SELECT
          s.id, s.seat_label, s.section, s.row_number, s.seat_number, ri.unit_price
        FROM reservation_items ri
        JOIN seats s ON ri.seat_id = s.id
        WHERE ri.reservation_id = $1`,
        [reservationId]
      );

      // Get event details
      const eventResult = await client.query(
        `SELECT title, venue, event_date
         FROM events
         WHERE id = $1`,
        [reservation.event_id]
      );

      return { reservation, seats: seatsResult.rows, event: eventResult.rows[0] };
    });

    res.json({
      success: true,
      message: SUCCESS_MESSAGES.PAYMENT_COMPLETED,
      payment: {
        reservationId: result.reservation.id,
        reservationNumber: result.reservation.reservation_number,
        paymentMethod: getPaymentMethodName(paymentMethod),
        totalAmount: result.reservation.total_amount,
        paidAt: new Date().toISOString(),
      },
      reservation: {
        event: result.event,
        seats: result.seats,
      },
    });

  } catch (error) {
    // 메트릭 추가: 결제 실패
    if (eventId) {
      try {
        paymentsTotal.labels({
          status: 'failed',
          event_id: eventId,
          payment_method: paymentMethod || 'unknown'
        }).inc();
      } catch (metricError) {
        logger.error('⚠️  메트릭 기록 실패:', metricError);
      }
    }

    next(new CustomError(400, 'Payment process error', error));
  }
});

/**
 * @swagger
 * /api/payments/methods:
 *   get:
 *     summary: 결제 수단 목록 조회
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: 결제 수단 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 methods:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 */
router.get('/methods', (req, res, next) => {
  res.json({
    methods: [
      {
        id: PAYMENT_METHODS.NAVER_PAY,
        name: '네이버페이',
        description: '네이버페이로 간편 결제',
        icon: '/images/naver-pay.png',
      },
      {
        id: PAYMENT_METHODS.KAKAO_PAY,
        name: '카카오페이',
        description: '카카오페이로 간편 결제',
        icon: '/images/kakao-pay.png',
      },
      {
        id: PAYMENT_METHODS.BANK_TRANSFER,
        name: '계좌이체',
        description: '계좌이체로 결제',
        icon: '/images/bank-transfer.png',
      },
    ],
  });
});

/**
 * Simulate payment processing (mock)
 * @param {string} paymentMethod
 * @returns {Promise<void>}
 * @private
 */
function simulatePaymentProcessing(paymentMethod) {
  // Simulate API call delay
  const delay = Math.random() * (PAYMENT_SETTINGS.MOCK_MAX_DELAY_MS - PAYMENT_SETTINGS.MOCK_MIN_DELAY_MS) + PAYMENT_SETTINGS.MOCK_MIN_DELAY_MS;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Get payment method display name
 * @param {string} method
 * @returns {string}
 * @private
 */
function getPaymentMethodName(method) {
  const names = {
    [PAYMENT_METHODS.NAVER_PAY]: '네이버페이',
    [PAYMENT_METHODS.KAKAO_PAY]: '카카오페이',
    [PAYMENT_METHODS.BANK_TRANSFER]: '계좌이체',
  };
  return names[method] || method;
}

/**
 * POST /api/payments/confirm
 * Toss Payments 결제 승인 (Payment Service로 프록시)
 */
router.post('/confirm', async (req, res, next) => {
  try {
    const axios = require('axios');
    const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3003';

    // Payment Service로 프록시
    const response = await axios.post(
      `${PAYMENT_SERVICE_URL}/api/payments/confirm`,
      req.body,
      {
        headers: {
          'Authorization': req.headers.authorization,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true, // Accept all status codes
      }
    );

    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('Payment Service proxy error:', error);
    next(new CustomError(503, 'Payment Service unavailable'));
  }
});

/**
 * POST /api/payments/prepare
 * Toss Payments 결제 준비 (Payment Service로 프록시)
 */
router.post('/prepare', async (req, res, next) => {
  try {
    const axios = require('axios');
    const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3003';

    // Payment Service로 프록시
    const response = await axios.post(
      `${PAYMENT_SERVICE_URL}/api/payments/prepare`,
      req.body,
      {
        headers: {
          'Authorization': req.headers.authorization,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      }
    );

    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('Payment Service proxy error:', error);
    next(new CustomError(503, 'Payment Service unavailable'));
  }
});

module.exports = router;

