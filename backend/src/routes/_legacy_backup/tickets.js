const express = require('express');
const db = require('../config/database');
const { logger } = require('../utils/logger');
const CustomError = require('../utils/custom-error');
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
 * /api/tickets/event/{eventId}:
 *   get:
 *     summary: 특정 이벤트의 티켓 타입 조회
 *     tags: [Tickets]
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
 *         description: 티켓 타입 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ticketTypes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TicketType'
 */
router.get('/event/:eventId', async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!ensureUUID(eventId, res, 'eventId')) return;

    const result = await db.query(
      `SELECT 
        id, name, price, total_quantity, available_quantity, description
      FROM ticket_types 
      WHERE event_id = $1 
      ORDER BY price DESC`,
      [eventId]
    );

    res.json({ ticketTypes: result.rows });
  } catch (error) {
    next(new CustomError(500, '티켓 정보를 불러오는데 실패했습니다.', error));
  }
});

/**
 * @swagger
 * /api/tickets/availability/{ticketTypeId}:
 *   get:
 *     summary: 티켓 재고 확인
 *     tags: [Tickets]
 *     parameters:
 *       - in: path
 *         name: ticketTypeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 티켓 타입 ID
 *     responses:
 *       200:
 *         description: 티켓 재고 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available_quantity:
 *                   type: integer
 *                 total_quantity:
 *                   type: integer
 *       404:
 *         description: 티켓 타입을 찾을 수 없음
 */
router.get('/availability/:ticketTypeId', async (req, res, next) => {
  try {
    const { ticketTypeId } = req.params;
    if (!ensureUUID(ticketTypeId, res, 'ticketTypeId')) return;

    const result = await db.query(
      'SELECT available_quantity, total_quantity FROM ticket_types WHERE id = $1',
      [ticketTypeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '티켓 타입을 찾을 수 없습니다.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(new CustomError(500, '재고 확인에 실패했습니다.', error));
  }
});

module.exports = router;

