/**
 * Tickets Routes
 * 티켓 타입 조회, 재고 확인
 */

const express = require('express');
const db = require('../config/database');
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
 * GET /tickets/event/:eventId
 * 특정 이벤트의 티켓 타입 조회
 */
router.get('/event/:eventId', async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!ensureUUID(eventId, res, 'eventId')) return;

    const result = await db.query(
      `SELECT
        id, name, price, total_quantity, available_quantity, description
      FROM ticket_schema.ticket_types
      WHERE event_id = $1
      ORDER BY price DESC`,
      [eventId]
    );

    res.json({ ticketTypes: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /tickets/availability/:ticketTypeId
 * 티켓 재고 확인
 */
router.get('/availability/:ticketTypeId', async (req, res, next) => {
  try {
    const { ticketTypeId } = req.params;
    if (!ensureUUID(ticketTypeId, res, 'ticketTypeId')) return;

    const result = await db.query(
      'SELECT available_quantity, total_quantity FROM ticket_schema.ticket_types WHERE id = $1',
      [ticketTypeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '티켓 타입을 찾을 수 없습니다.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
