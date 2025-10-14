const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { client: redisClient } = require('../config/redis');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// 대시보드 통계
router.get('/dashboard/stats', async (req, res) => {
  try {
    // Total events
    const eventsResult = await db.query('SELECT COUNT(*) as count FROM events');
    const totalEvents = parseInt(eventsResult.rows[0].count);

    // Total reservations
    const reservationsResult = await db.query('SELECT COUNT(*) as count FROM reservations WHERE status != $1', ['cancelled']);
    const totalReservations = parseInt(reservationsResult.rows[0].count);

    // Total revenue
    const revenueResult = await db.query(
      'SELECT COALESCE(SUM(total_amount), 0) as total FROM reservations WHERE payment_status = $1',
      ['completed']
    );
    const totalRevenue = parseInt(revenueResult.rows[0].total);

    // Today's reservations
    const todayResult = await db.query(
      `SELECT COUNT(*) as count 
       FROM reservations 
       WHERE DATE(created_at) = CURRENT_DATE AND status != 'cancelled'`
    );
    const todayReservations = parseInt(todayResult.rows[0].count);

    // Recent reservations
    const recentResult = await db.query(
      `SELECT 
        r.id, r.reservation_number, r.total_amount, r.status, r.created_at,
        u.name as user_name, u.email as user_email,
        e.title as event_title
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN events e ON r.event_id = e.id
      ORDER BY r.created_at DESC
      LIMIT 10`
    );

    res.json({
      stats: {
        totalEvents,
        totalReservations,
        totalRevenue,
        todayReservations,
      },
      recentReservations: recentResult.rows,
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: '통계 정보를 불러오는데 실패했습니다.' });
  }
});

// 이벤트 생성
router.post('/events', async (req, res) => {
  try {
    const {
      title,
      description,
      venue,
      address,
      eventDate,
      saleStartDate,
      saleEndDate,
      posterImageUrl,
    } = req.body;

    const result = await db.query(
      `INSERT INTO events 
       (title, description, venue, address, event_date, sale_start_date, sale_end_date, poster_image_url, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'upcoming')
       RETURNING *`,
      [title, description, venue, address, eventDate, saleStartDate, saleEndDate, posterImageUrl, req.user.userId]
    );

    // Invalidate cache
    await redisClient.del('events:all:1:10');

    res.status(201).json({
      message: '이벤트가 생성되었습니다.',
      event: result.rows[0],
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: '이벤트 생성에 실패했습니다.' });
  }
});

// 이벤트 수정
router.put('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      venue,
      address,
      eventDate,
      saleStartDate,
      saleEndDate,
      posterImageUrl,
      status,
    } = req.body;

    const result = await db.query(
      `UPDATE events 
       SET title = $1, description = $2, venue = $3, address = $4,
           event_date = $5, sale_start_date = $6, sale_end_date = $7,
           poster_image_url = $8, status = $9
       WHERE id = $10
       RETURNING *`,
      [title, description, venue, address, eventDate, saleStartDate, saleEndDate, posterImageUrl, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '이벤트를 찾을 수 없습니다.' });
    }

    // Invalidate cache
    await redisClient.del(`event:${id}`);
    await redisClient.del('events:all:1:10');

    res.json({
      message: '이벤트가 수정되었습니다.',
      event: result.rows[0],
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: '이벤트 수정에 실패했습니다.' });
  }
});

// 이벤트 삭제
router.delete('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if there are any reservations
    const reservationsResult = await db.query(
      'SELECT COUNT(*) as count FROM reservations WHERE event_id = $1 AND status != $2',
      [id, 'cancelled']
    );

    if (parseInt(reservationsResult.rows[0].count) > 0) {
      return res.status(400).json({ error: '예매가 존재하는 이벤트는 삭제할 수 없습니다.' });
    }

    await db.query('DELETE FROM events WHERE id = $1', [id]);

    // Invalidate cache
    await redisClient.del(`event:${id}`);
    await redisClient.del('events:all:1:10');

    res.json({ message: '이벤트가 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: '이벤트 삭제에 실패했습니다.' });
  }
});

// 티켓 타입 생성
router.post('/events/:eventId/tickets', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { name, price, totalQuantity, description } = req.body;

    const result = await db.query(
      `INSERT INTO ticket_types 
       (event_id, name, price, total_quantity, available_quantity, description)
       VALUES ($1, $2, $3, $4, $4, $5)
       RETURNING *`,
      [eventId, name, price, totalQuantity, description]
    );

    // Invalidate cache
    await redisClient.del(`event:${eventId}`);

    res.status(201).json({
      message: '티켓이 등록되었습니다.',
      ticketType: result.rows[0],
    });
  } catch (error) {
    console.error('Create ticket type error:', error);
    res.status(500).json({ error: '티켓 등록에 실패했습니다.' });
  }
});

// 티켓 타입 수정
router.put('/tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, totalQuantity, description } = req.body;

    // Get current ticket type
    const currentResult = await db.query(
      'SELECT total_quantity, available_quantity, event_id FROM ticket_types WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: '티켓을 찾을 수 없습니다.' });
    }

    const current = currentResult.rows[0];
    const sold = current.total_quantity - current.available_quantity;
    const newAvailable = totalQuantity - sold;

    if (newAvailable < 0) {
      return res.status(400).json({ error: '판매된 티켓 수보다 적은 수량으로 변경할 수 없습니다.' });
    }

    const result = await db.query(
      `UPDATE ticket_types 
       SET name = $1, price = $2, total_quantity = $3, available_quantity = $4, description = $5
       WHERE id = $6
       RETURNING *`,
      [name, price, totalQuantity, newAvailable, description, id]
    );

    // Invalidate cache
    await redisClient.del(`event:${current.event_id}`);

    res.json({
      message: '티켓이 수정되었습니다.',
      ticketType: result.rows[0],
    });
  } catch (error) {
    console.error('Update ticket type error:', error);
    res.status(500).json({ error: '티켓 수정에 실패했습니다.' });
  }
});

// 모든 예매 내역 조회 (관리자)
router.get('/reservations', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        r.id, r.reservation_number, r.total_amount, r.status, r.payment_status,
        r.created_at,
        u.name as user_name, u.email as user_email,
        e.title as event_title, e.venue, e.event_date
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN events e ON r.event_id = e.id
    `;
    
    const params = [];
    if (status) {
      query += ' WHERE r.status = $1';
      params.push(status);
    }
    
    query += ' ORDER BY r.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parseInt(limit), offset);

    const result = await db.query(query, params);

    // Count total
    let countQuery = 'SELECT COUNT(*) FROM reservations';
    const countParams = [];
    if (status) {
      countQuery += ' WHERE status = $1';
      countParams.push(status);
    }
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      reservations: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    console.error('Get all reservations error:', error);
    res.status(500).json({ error: '예매 내역을 불러오는데 실패했습니다.' });
  }
});

// 예매 상태 변경 (관리자)
router.patch('/reservations/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus } = req.body;

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (status) {
      updates.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (paymentStatus) {
      updates.push(`payment_status = $${paramCount}`);
      params.push(paymentStatus);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '변경할 상태를 지정해주세요.' });
    }

    params.push(id);

    const result = await db.query(
      `UPDATE reservations SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '예매를 찾을 수 없습니다.' });
    }

    res.json({
      message: '예매 상태가 변경되었습니다.',
      reservation: result.rows[0],
    });
  } catch (error) {
    console.error('Update reservation status error:', error);
    res.status(500).json({ error: '예매 상태 변경에 실패했습니다.' });
  }
});

module.exports = router;

