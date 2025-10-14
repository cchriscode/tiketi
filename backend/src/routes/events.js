const express = require('express');
const db = require('../config/database');
const { client: redisClient } = require('../config/redis');

const router = express.Router();

// 이벤트 목록 조회 (캐싱 적용)
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Try cache first
    const cacheKey = `events:${status || 'all'}:${page}:${limit}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    let query = `
      SELECT 
        e.id, e.title, e.description, e.venue, e.address,
        e.event_date, e.sale_start_date, e.sale_end_date,
        e.poster_image_url, e.status,
        COUNT(DISTINCT tt.id) as ticket_type_count,
        MIN(tt.price) as min_price,
        MAX(tt.price) as max_price
      FROM events e
      LEFT JOIN ticket_types tt ON e.id = tt.event_id
    `;
    
    const params = [];
    if (status) {
      query += ' WHERE e.status = $1';
      params.push(status);
    }
    
    query += ' GROUP BY e.id ORDER BY e.event_date DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parseInt(limit), offset);

    const result = await db.query(query, params);

    // Count total
    let countQuery = 'SELECT COUNT(*) FROM events';
    const countParams = [];
    if (status) {
      countQuery += ' WHERE status = $1';
      countParams.push(status);
    }
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    const response = {
      events: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      }
    };

    // Cache for 5 minutes
    await redisClient.setEx(cacheKey, 300, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: '이벤트 목록을 불러오는데 실패했습니다.' });
  }
});

// 이벤트 상세 조회 (티켓 타입 포함)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Try cache first
    const cacheKey = `event:${id}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Get event details
    const eventResult = await db.query(
      'SELECT * FROM events WHERE id = $1',
      [id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: '이벤트를 찾을 수 없습니다.' });
    }

    // Get ticket types
    const ticketTypesResult = await db.query(
      `SELECT 
        id, name, price, total_quantity, available_quantity, description
      FROM ticket_types 
      WHERE event_id = $1 
      ORDER BY price DESC`,
      [id]
    );

    const response = {
      event: eventResult.rows[0],
      ticketTypes: ticketTypesResult.rows,
    };

    // Cache for 2 minutes
    await redisClient.setEx(cacheKey, 120, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    console.error('Get event detail error:', error);
    res.status(500).json({ error: '이벤트 정보를 불러오는데 실패했습니다.' });
  }
});

module.exports = router;

