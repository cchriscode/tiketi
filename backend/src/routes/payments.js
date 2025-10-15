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

const router = express.Router();

/**
 * POST /api/payments/process
 * Process payment for a reservation (MOCK - no real PG integration)
 */
router.post('/process', authenticateToken, async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { reservationId, paymentMethod } = req.body;
    const userId = req.user.userId;
    
    // Validation
    if (!reservationId || !paymentMethod) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const validMethods = Object.values(PAYMENT_METHODS);
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: ERROR_MESSAGES.INVALID_PAYMENT_METHOD });
    }
    
    await client.query('BEGIN');
    
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
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: SUCCESS_MESSAGES.PAYMENT_COMPLETED,
      payment: {
        reservationId: reservation.id,
        reservationNumber: reservation.reservation_number,
        paymentMethod: getPaymentMethodName(paymentMethod),
        totalAmount: reservation.total_amount,
        paidAt: new Date().toISOString(),
      },
      reservation: {
        event: eventResult.rows[0],
        seats: seatsResult.rows,
      },
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Payment process error:', error);
    res.status(400).json({ 
      success: false,
      error: error.message || ERROR_MESSAGES.PAYMENT_FAILED 
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/payments/methods
 * Get available payment methods
 */
router.get('/methods', (req, res) => {
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

module.exports = router;

