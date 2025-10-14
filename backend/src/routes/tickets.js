const express = require('express');
const db = require('../config/database');

const router = express.Router();

// 특정 이벤트의 티켓 타입 조회
router.get('/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

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
    console.error('Get ticket types error:', error);
    res.status(500).json({ error: '티켓 정보를 불러오는데 실패했습니다.' });
  }
});

// 티켓 재고 확인
router.get('/availability/:ticketTypeId', async (req, res) => {
  try {
    const { ticketTypeId } = req.params;

    const result = await db.query(
      'SELECT available_quantity, total_quantity FROM ticket_types WHERE id = $1',
      [ticketTypeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '티켓 타입을 찾을 수 없습니다.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({ error: '재고 확인에 실패했습니다.' });
  }
});

module.exports = router;

