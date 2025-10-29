const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { client: redisClient } = require('../config/redis');
const seatGenerator = require('../services/seat-generator');
const {
  EVENT_STATUS,
  RESERVATION_STATUS,
  PAYMENT_STATUS,
  SEAT_STATUS,
  CACHE_KEYS,
  PAGINATION_DEFAULTS,
} = require('../shared/constants');

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
    const reservationsResult = await db.query(
      'SELECT COUNT(*) as count FROM reservations WHERE status != $1', 
      [RESERVATION_STATUS.CANCELLED]
    );
    const totalReservations = parseInt(reservationsResult.rows[0].count);

    // Total revenue
    const revenueResult = await db.query(
      'SELECT COALESCE(SUM(total_amount), 0) as total FROM reservations WHERE payment_status = $1',
      [PAYMENT_STATUS.COMPLETED]
    );
    const totalRevenue = parseInt(revenueResult.rows[0].total);

    // Today's reservations
    const todayResult = await db.query(
      `SELECT COUNT(*) as count 
       FROM reservations 
       WHERE DATE(created_at) = CURRENT_DATE AND status != $1`,
      [RESERVATION_STATUS.CANCELLED]
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

// 좌석 레이아웃 목록 조회
router.get('/seat-layouts', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, description, total_seats, layout_config FROM seat_layouts ORDER BY name'
    );
    
    res.json({ layouts: result.rows });
  } catch (error) {
    console.error('Get seat layouts error:', error);
    res.status(500).json({ error: '좌석 레이아웃을 불러오는데 실패했습니다.' });
  }
});

// 이벤트 생성 (좌석 선택 기능 포함)
router.post('/events', async (req, res) => {
  const client = await db.getClient();
  
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
      artistName,
      seatLayoutId, // 좌석 레이아웃 ID (좌석 선택 방식)
      ticketTypes, // 티켓 등급 배열 (티켓 등급 방식)
    } = req.body;

    await client.query('BEGIN');

    // 현재 시간 기준으로 초기 상태 계산
    const now = new Date();
    const saleStart = new Date(saleStartDate);
    const saleEnd = new Date(saleEndDate);

    let initialStatus;
    if (now < saleStart) {
      initialStatus = EVENT_STATUS.UPCOMING;
    } else if (now >= saleStart && now < saleEnd) {
      initialStatus = EVENT_STATUS.ON_SALE;
    } else {
      initialStatus = EVENT_STATUS.ENDED;
    }

    console.log(`🆕 새 이벤트 생성 - 초기 상태: ${initialStatus}`);
    console.log(`  현재 시간: ${now.toISOString()}`);
    console.log(`  예매 시작: ${saleStart.toISOString()}`);
    console.log(`  예매 종료: ${saleEnd.toISOString()}`);

    const result = await client.query(
      `INSERT INTO events
       (title, description, venue, address, event_date, sale_start_date, sale_end_date,
        poster_image_url, artist_name, seat_layout_id, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [title, description, venue, address, eventDate, saleStartDate, saleEndDate,
       posterImageUrl, artistName, seatLayoutId || null, req.user.userId, initialStatus]
    );

    const event = result.rows[0];

    // 좌석 선택 방식: 좌석 레이아웃으로 개별 좌석 생성
    if (seatLayoutId) {
      // Pass the transaction client to seat generator
      await seatGenerator.generateSeatsForEvent(event.id, seatLayoutId, client);
      console.log(`✅ Generated seats for event: ${event.title} (Layout: ${seatLayoutId})`);
    }
    
    // 티켓 등급 방식: 티켓 타입 생성
    if (ticketTypes && Array.isArray(ticketTypes) && ticketTypes.length > 0) {
      for (const ticketType of ticketTypes) {
        await client.query(
          `INSERT INTO ticket_types (event_id, name, price, total_quantity, available_quantity, description)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            event.id,
            ticketType.name,
            ticketType.price,
            ticketType.totalQuantity,
            ticketType.totalQuantity, // available_quantity initially equals total_quantity
            ticketType.description || null,
          ]
        );
      }
      console.log(`✅ Created ${ticketTypes.length} ticket types for event: ${event.title}`);
    }

    await client.query('COMMIT');

    // 이벤트 상태 업데이터 타이머 재설정
    const eventStatusUpdater = require('../services/event-status-updater');
    eventStatusUpdater.reschedule();
    console.log('🔄 이벤트 상태 업데이터 타이머 재설정');

    // Invalidate all event list caches (즉시 반영을 위해 모든 캐시 삭제)
    try {
      const keys = await redisClient.keys(CACHE_KEYS.EVENTS_PATTERN);
      if (keys && keys.length > 0) {
        await redisClient.del(keys);
        console.log(`🗑️  이벤트 목록 캐시 ${keys.length}개 삭제 (즉시 반영)`);
      }
    } catch (cacheError) {
      console.error('⚠️  캐시 삭제 중 에러 (계속 진행):', cacheError.message);
    }

    res.status(201).json({
      message: '이벤트가 생성되었습니다.',
      event,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create event error:', error);
    res.status(500).json({ error: '이벤트 생성에 실패했습니다.' });
  } finally {
    client.release();
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
      artistName,
    } = req.body;

    console.log('🔍 이벤트 수정 요청:');
    console.log('  eventDate:', eventDate);
    console.log('  saleStartDate:', saleStartDate);
    console.log('  saleEndDate:', saleEndDate);
    
    // 날짜를 한국 시간으로 변환해서 출력
    if (saleStartDate) {
      const kst = new Date(new Date(saleStartDate).getTime() + (9 * 60 * 60 * 1000));
      console.log('  saleStartDate (KST):', kst.toISOString().replace('T', ' ').slice(0, 16));
    }
    if (saleEndDate) {
      const kst = new Date(new Date(saleEndDate).getTime() + (9 * 60 * 60 * 1000));
      console.log('  saleEndDate (KST):', kst.toISOString().replace('T', ' ').slice(0, 16));
    }

    // 상태는 event-status-updater가 자동으로 관리하므로 수동 업데이트 제외
    const result = await db.query(
      `UPDATE events 
       SET title = $1, description = $2, venue = $3, address = $4,
           event_date = $5, sale_start_date = $6, sale_end_date = $7,
           poster_image_url = $8, artist_name = $9
       WHERE id = $10
       RETURNING *`,
      [title, description, venue, address, eventDate, saleStartDate, saleEndDate, posterImageUrl, artistName, id]
    );

    console.log('✅ UPDATE 쿼리 실행 완료');
    console.log('  영향받은 행 수:', result.rowCount);
    
    if (result.rows.length === 0) {
      console.error('❌ 이벤트를 찾을 수 없음:', id);
      return res.status(404).json({ error: '이벤트를 찾을 수 없습니다.' });
    }

    console.log('✅ 업데이트된 이벤트:', result.rows[0].title);
    console.log('  sale_start_date:', result.rows[0].sale_start_date);
    console.log('  sale_end_date:', result.rows[0].sale_end_date);

    // 수정 후 즉시 상태를 계산하여 업데이트
    const updatedEvent = result.rows[0];
    const now = new Date();
    const saleStart = new Date(updatedEvent.sale_start_date);
    const saleEnd = new Date(updatedEvent.sale_end_date);
    
    let newStatus = updatedEvent.status;
    
    // 취소된 이벤트가 아닌 경우에만 상태 자동 계산
    if (updatedEvent.status !== EVENT_STATUS.CANCELLED) {
      if (now < saleStart) {
        newStatus = EVENT_STATUS.UPCOMING;
      } else if (now >= saleStart && now < saleEnd) {
        newStatus = EVENT_STATUS.ON_SALE;
      } else if (now >= saleEnd) {
        newStatus = EVENT_STATUS.ENDED;
      }
      
      // 상태가 변경되었으면 업데이트
      if (newStatus !== updatedEvent.status) {
        await db.query(
          'UPDATE events SET status = $1 WHERE id = $2',
          [newStatus, id]
        );
        console.log(`🔄 상태 자동 업데이트: ${updatedEvent.status} → ${newStatus}`);
      }
    }

    // 이벤트 상태 업데이터 타이머 재설정
    const eventStatusUpdater = require('../services/event-status-updater');
    eventStatusUpdater.reschedule();
    console.log('🔄 이벤트 상태 업데이터 타이머 재설정');

    // Invalidate cache - 모든 관련 캐시 삭제 (즉시 반영)
    try {
      await redisClient.del(CACHE_KEYS.EVENT(id));
      
      // events:로 시작하는 모든 캐시 키 삭제
      const keys = await redisClient.keys(CACHE_KEYS.EVENTS_PATTERN);
      if (keys && keys.length > 0) {
        await redisClient.del(keys);
        console.log(`🗑️  이벤트 목록 캐시 ${keys.length}개 삭제 (즉시 반영)`);
      }
    } catch (cacheError) {
      console.error('⚠️  캐시 삭제 중 에러 (계속 진행):', cacheError.message);
    }

    res.json({
      message: '이벤트가 수정되었습니다.',
      event: { ...result.rows[0], status: newStatus },
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: '이벤트 수정에 실패했습니다.' });
  }
});

// 이벤트 취소
router.post('/events/:id/cancel', async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // 이벤트 상태를 취소로 변경
    const eventResult = await client.query(
      `UPDATE events 
       SET status = $1
       WHERE id = $2 AND status != $1
       RETURNING *`,
      [EVENT_STATUS.CANCELLED, id]
    );

    if (eventResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '이벤트를 찾을 수 없거나 이미 취소되었습니다.' });
    }

    console.log(`🚫 이벤트 취소 시작: ${eventResult.rows[0].title}`);

    // 해당 이벤트의 모든 예약(pending, confirmed) 취소 및 환불 처리
    const cancelledReservations = await client.query(
      `UPDATE reservations 
       SET status = $1, 
           payment_status = CASE 
             WHEN payment_status = $2 THEN $3
             ELSE payment_status
           END
       WHERE event_id = $4 AND status IN ($5, $6)
       RETURNING id, reservation_number, status, payment_status, total_amount`,
      [
        RESERVATION_STATUS.CANCELLED,
        PAYMENT_STATUS.COMPLETED,
        PAYMENT_STATUS.REFUNDED,
        id,
        RESERVATION_STATUS.PENDING,
        RESERVATION_STATUS.CONFIRMED
      ]
    );

    console.log(`💰 취소된 예약: ${cancelledReservations.rowCount}건`);
    
    if (cancelledReservations.rowCount > 0) {
      let totalRefund = 0;
      cancelledReservations.rows.forEach(r => {
        if (r.payment_status === PAYMENT_STATUS.REFUNDED) {
          totalRefund += r.total_amount;
          console.log(`  - ${r.reservation_number}: ${r.total_amount}원 환불 처리`);
        }
      });
      console.log(`💸 총 환불 금액: ${totalRefund}원`);
    }

    // 좌석이 있는 경우 locked 좌석을 available로 변경
    const lockedSeats = await client.query(
      `UPDATE seats 
       SET status = $1
       WHERE event_id = $2 AND status = $3`,
      [SEAT_STATUS.AVAILABLE, id, SEAT_STATUS.LOCKED]
    );

    console.log(`🪑 잠금 해제된 좌석: ${lockedSeats.rowCount}개`);

    await client.query('COMMIT');

    // Invalidate cache - 모든 관련 캐시 삭제 (즉시 반영)
    try {
      await redisClient.del(CACHE_KEYS.EVENT(id));
      const keys = await redisClient.keys(CACHE_KEYS.EVENTS_PATTERN);
      if (keys && keys.length > 0) {
        await redisClient.del(keys);
        console.log(`🗑️  이벤트 목록 캐시 ${keys.length}개 삭제 (즉시 반영)`);
      }
    } catch (cacheError) {
      console.error('⚠️  캐시 삭제 중 에러:', cacheError.message);
    }

    console.log(`✅ 이벤트 취소 완료: ${eventResult.rows[0].title}`);

    res.json({
      message: '이벤트가 취소되었습니다. 모든 예약이 취소되고 결제 완료된 예약은 환불 처리되었습니다.',
      event: eventResult.rows[0],
      cancelledReservations: cancelledReservations.rowCount,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Cancel event error:', error);
    res.status(500).json({ error: '이벤트 취소에 실패했습니다.' });
  } finally {
    client.release();
  }
});

// 이벤트 삭제
router.delete('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if there are any reservations
    const reservationsResult = await db.query(
      'SELECT COUNT(*) as count FROM reservations WHERE event_id = $1 AND status != $2',
      [id, RESERVATION_STATUS.CANCELLED]
    );

    if (parseInt(reservationsResult.rows[0].count) > 0) {
      return res.status(400).json({ error: '예매가 존재하는 이벤트는 삭제할 수 없습니다.' });
    }

    await db.query('DELETE FROM events WHERE id = $1', [id]);

    // Invalidate cache (즉시 반영)
    try {
      await redisClient.del(CACHE_KEYS.EVENT(id));
      const keys = await redisClient.keys(CACHE_KEYS.EVENTS_PATTERN);
      if (keys && keys.length > 0) {
        await redisClient.del(keys);
        console.log(`🗑️  이벤트 목록 캐시 ${keys.length}개 삭제 (즉시 반영)`);
      }
    } catch (cacheError) {
      console.error('⚠️  캐시 삭제 중 에러:', cacheError.message);
    }

    res.json({ message: '이벤트가 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: '이벤트 삭제에 실패했습니다.' });
  }
});

// 이벤트 좌석 생성
router.post('/events/:id/generate-seats', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get event with seat layout
    const eventResult = await db.query(
      'SELECT id, title, seat_layout_id FROM events WHERE id = $1',
      [id]
    );
    
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: '이벤트를 찾을 수 없습니다.' });
    }
    
    const event = eventResult.rows[0];
    
    if (!event.seat_layout_id) {
      return res.status(400).json({ error: '좌석 레이아웃이 설정되지 않았습니다.' });
    }
    
    // Check if seats already exist
    const existsResult = await db.query(
      'SELECT COUNT(*) as count FROM seats WHERE event_id = $1',
      [id]
    );
    
    const existingSeats = parseInt(existsResult.rows[0].count);
    
    if (existingSeats > 0) {
      return res.status(400).json({ 
        error: '이미 좌석이 생성되어 있습니다.',
        existingSeats 
      });
    }
    
    // Generate seats
    const seatsCreated = await seatGenerator.generateSeatsForEvent(id, event.seat_layout_id);
    
    res.json({
      message: '좌석이 생성되었습니다.',
      seatsCreated,
      eventTitle: event.title,
    });
    
  } catch (error) {
    console.error('Generate seats error:', error);
    res.status(500).json({ error: '좌석 생성에 실패했습니다.' });
  }
});

// 이벤트 좌석 삭제 (재생성을 위해)
router.delete('/events/:id/seats', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if there are any reservations with seats
    const reservationsResult = await db.query(
      `SELECT COUNT(*) as count 
       FROM reservations r
       JOIN reservation_items ri ON r.id = ri.reservation_id
       WHERE r.event_id = $1 
       AND ri.seat_id IS NOT NULL 
       AND r.status != 'cancelled'`,
      [id]
    );
    
    if (parseInt(reservationsResult.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: '예약된 좌석이 있어 삭제할 수 없습니다.' 
      });
    }
    
    const seatsDeleted = await seatGenerator.deleteSeatsForEvent(id);
    
    res.json({
      message: '좌석이 삭제되었습니다.',
      seatsDeleted,
    });
    
  } catch (error) {
    console.error('Delete seats error:', error);
    res.status(500).json({ error: '좌석 삭제에 실패했습니다.' });
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
    await redisClient.del(CACHE_KEYS.EVENT(eventId));

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
    await redisClient.del(CACHE_KEYS.EVENT(current.event_id));

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
    const { 
      page = PAGINATION_DEFAULTS.PAGE, 
      limit = PAGINATION_DEFAULTS.RESERVATIONS_LIMIT, 
      status 
    } = req.query;
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

