/**
 * Stats Routes
 * 통계 및 대시보드 데이터 제공
 */

const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /stats/overview
 * 전체 개요 통계 (대시보드용)
 */
router.get('/overview', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    // 전체 통계 쿼리
    const stats = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM auth_schema.users) as total_users,
        (SELECT COUNT(*) FROM ticket_schema.events WHERE status = 'on_sale') as active_events,
        (SELECT COUNT(*) FROM ticket_schema.reservations) as total_reservations,
        (SELECT COUNT(*) FROM ticket_schema.reservations WHERE status = 'confirmed') as confirmed_reservations,
        (SELECT COALESCE(SUM(total_amount), 0) FROM ticket_schema.reservations WHERE status = 'confirmed') as total_revenue,
        (SELECT COUNT(*) FROM payment_schema.payments WHERE status = 'confirmed') as completed_payments,
        (SELECT COALESCE(SUM(amount), 0) FROM payment_schema.payments WHERE status = 'confirmed') as payment_revenue
    `);

    res.json({
      success: true,
      data: stats.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stats/daily
 * 일별 통계 (최근 30일)
 */
router.get('/daily', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { days = 30 } = req.query;

    const dailyStats = await db.query(`
      SELECT
        DATE(r.created_at) as date,
        COUNT(*) as reservations,
        COUNT(*) FILTER (WHERE r.status = 'confirmed') as confirmed,
        COUNT(*) FILTER (WHERE r.status = 'cancelled') as cancelled,
        COALESCE(SUM(r.total_amount) FILTER (WHERE r.status = 'confirmed'), 0) as revenue
      FROM ticket_schema.reservations r
      WHERE r.created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(r.created_at)
      ORDER BY date DESC
    `);

    res.json({
      success: true,
      data: dailyStats.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stats/events
 * 이벤트별 통계
 */
router.get('/events', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { limit = 10, sortBy = 'revenue' } = req.query;

    let orderBy = 'revenue DESC';
    if (sortBy === 'reservations') orderBy = 'reservations DESC';
    else if (sortBy === 'occupancy') orderBy = 'occupancy_rate DESC';

    const eventStats = await db.query(`
      SELECT
        e.id,
        e.title,
        e.venue,
        e.event_date,
        e.status,
        COUNT(DISTINCT r.id) as reservations,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'confirmed') as confirmed_reservations,
        COALESCE(SUM(r.total_amount) FILTER (WHERE r.status = 'confirmed'), 0) as revenue,
        COUNT(DISTINCT s.id) as total_seats,
        COUNT(DISTINCT ri.seat_id) FILTER (WHERE r.status = 'confirmed') as sold_seats,
        ROUND(
          CAST(COUNT(DISTINCT ri.seat_id) FILTER (WHERE r.status = 'confirmed') AS NUMERIC) /
          NULLIF(COUNT(DISTINCT s.id), 0) * 100,
          2
        ) as occupancy_rate
      FROM ticket_schema.events e
      LEFT JOIN ticket_schema.reservations r ON e.id = r.event_id
      LEFT JOIN ticket_schema.reservation_items ri ON r.id = ri.reservation_id
      LEFT JOIN ticket_schema.seats s ON e.id = s.event_id
      GROUP BY e.id, e.title, e.venue, e.event_date, e.status
      ORDER BY ${orderBy}
      LIMIT $1
    `, [parseInt(limit)]);

    res.json({
      success: true,
      data: eventStats.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stats/events/:eventId
 * 특정 이벤트 상세 통계
 */
router.get('/events/:eventId', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const eventStats = await db.query(`
      SELECT
        e.id,
        e.title,
        e.venue,
        e.event_date,
        e.status,
        COUNT(DISTINCT r.id) as total_reservations,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'confirmed') as confirmed_reservations,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'pending') as pending_reservations,
        COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'cancelled') as cancelled_reservations,
        COALESCE(SUM(r.total_amount) FILTER (WHERE r.status = 'confirmed'), 0) as total_revenue,
        COUNT(DISTINCT s.id) as total_seats,
        COUNT(DISTINCT ri.seat_id) FILTER (WHERE r.status = 'confirmed') as sold_seats,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'available') as available_seats,
        ROUND(
          CAST(COUNT(DISTINCT ri.seat_id) FILTER (WHERE r.status = 'confirmed') AS NUMERIC) /
          NULLIF(COUNT(DISTINCT s.id), 0) * 100,
          2
        ) as occupancy_rate
      FROM ticket_schema.events e
      LEFT JOIN ticket_schema.reservations r ON e.id = r.event_id
      LEFT JOIN ticket_schema.reservation_items ri ON r.id = ri.reservation_id
      LEFT JOIN ticket_schema.seats s ON e.id = s.event_id
      WHERE e.id = $1
      GROUP BY e.id, e.title, e.venue, e.event_date, e.status
    `, [eventId]);

    if (eventStats.rows.length === 0) {
      return res.status(404).json({ error: '이벤트를 찾을 수 없습니다.' });
    }

    // 일별 예약 추이
    const dailyTrend = await db.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as reservations,
        SUM(total_amount) as revenue
      FROM ticket_schema.reservations
      WHERE event_id = $1
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [eventId]);

    res.json({
      success: true,
      data: {
        overview: eventStats.rows[0],
        dailyTrend: dailyTrend.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stats/payments
 * 결제 수단별 통계
 */
router.get('/payments', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const paymentStats = await db.query(`
      SELECT
        method,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        AVG(amount) as average_amount
      FROM payment_schema.payments
      WHERE status = 'confirmed'
      GROUP BY method
      ORDER BY total_amount DESC
    `);

    res.json({
      success: true,
      data: paymentStats.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stats/revenue
 * 매출 통계 (일/주/월별)
 */
router.get('/revenue', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { period = 'daily', days = 30 } = req.query;

    let groupByClause = 'DATE(p.created_at)';
    let intervalDays = parseInt(days);

    if (period === 'weekly') {
      groupByClause = 'DATE_TRUNC(\'week\', p.created_at)';
      intervalDays = 90; // 3 months for weekly
    } else if (period === 'monthly') {
      groupByClause = 'DATE_TRUNC(\'month\', p.created_at)';
      intervalDays = 365; // 1 year for monthly
    }

    const revenueStats = await db.query(`
      SELECT
        ${groupByClause} as period,
        COUNT(*) as payment_count,
        SUM(amount) as total_revenue,
        AVG(amount) as average_amount
      FROM payment_schema.payments p
      WHERE p.status = 'confirmed'
        AND p.created_at >= CURRENT_DATE - INTERVAL '${intervalDays} days'
      GROUP BY ${groupByClause}
      ORDER BY period DESC
    `);

    res.json({
      success: true,
      data: revenueStats.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stats/users
 * 사용자 통계
 */
router.get('/users', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const userStats = await db.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as new_users,
        SUM(COUNT(*)) OVER (ORDER BY DATE(created_at)) as cumulative_users
      FROM auth_schema.users
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    const roleStats = await db.query(`
      SELECT
        role,
        COUNT(*) as count
      FROM auth_schema.users
      GROUP BY role
    `);

    res.json({
      success: true,
      data: {
        daily: userStats.rows,
        byRole: roleStats.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stats/hourly-traffic
 * 시간대별 트래픽 분석 (0-23시)
 */
router.get('/hourly-traffic', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { days = 7 } = req.query;

    const hourlyStats = await db.query(`
      SELECT
        EXTRACT(HOUR FROM r.created_at) as hour,
        COUNT(*) as total_reservations,
        COUNT(*) FILTER (WHERE r.status = 'confirmed') as confirmed,
        COUNT(*) FILTER (WHERE r.status = 'cancelled') as cancelled,
        COALESCE(SUM(r.total_amount) FILTER (WHERE r.status = 'confirmed'), 0) as revenue
      FROM ticket_schema.reservations r
      WHERE r.created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY EXTRACT(HOUR FROM r.created_at)
      ORDER BY hour
    `);

    // 주말 vs 평일 분석
    const weekdayStats = await db.query(`
      SELECT
        CASE
          WHEN EXTRACT(DOW FROM r.created_at) IN (0, 6) THEN 'weekend'
          ELSE 'weekday'
        END as day_type,
        COUNT(*) as reservations,
        AVG(r.total_amount) as avg_amount
      FROM ticket_schema.reservations r
      WHERE r.created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
        AND r.status = 'confirmed'
      GROUP BY day_type
    `);

    // Peak hour 계산
    const peakHour = hourlyStats.rows.reduce((max, current) =>
      parseInt(current.total_reservations) > parseInt(max.total_reservations || 0) ? current : max
    , {});

    res.json({
      success: true,
      data: {
        hourly: hourlyStats.rows,
        weekdayComparison: weekdayStats.rows,
        peakHour: {
          hour: peakHour.hour,
          reservations: peakHour.total_reservations,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stats/conversion
 * 전환율 분석 (조회 → 좌석선택 → 결제)
 */
router.get('/conversion', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { days = 30 } = req.query;

    // 전체 예약 생성 건수 (좌석 선택 단계)
    const totalReservations = await db.query(`
      SELECT COUNT(*) as count
      FROM ticket_schema.reservations
      WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
    `);

    // 결제 완료 건수
    const completedPayments = await db.query(`
      SELECT COUNT(*) as count
      FROM ticket_schema.reservations
      WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
        AND status = 'confirmed'
    `);

    // 취소 건수
    const cancelledReservations = await db.query(`
      SELECT COUNT(*) as count
      FROM ticket_schema.reservations
      WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
        AND status = 'cancelled'
    `);

    // 대기 중 건수
    const pendingReservations = await db.query(`
      SELECT COUNT(*) as count
      FROM ticket_schema.reservations
      WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
        AND status = 'pending'
    `);

    const total = parseInt(totalReservations.rows[0].count);
    const completed = parseInt(completedPayments.rows[0].count);
    const cancelled = parseInt(cancelledReservations.rows[0].count);
    const pending = parseInt(pendingReservations.rows[0].count);

    const conversionRate = total > 0 ? ((completed / total) * 100).toFixed(2) : 0;
    const cancellationRate = total > 0 ? ((cancelled / total) * 100).toFixed(2) : 0;
    const pendingRate = total > 0 ? ((pending / total) * 100).toFixed(2) : 0;

    // 일별 전환율 추이
    const dailyConversion = await db.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'confirmed') as completed,
        ROUND(
          CAST(COUNT(*) FILTER (WHERE status = 'confirmed') AS NUMERIC) /
          NULLIF(COUNT(*), 0) * 100,
          2
        ) as conversion_rate
      FROM ticket_schema.reservations
      WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    res.json({
      success: true,
      data: {
        funnel: {
          total_started: total,
          completed: completed,
          cancelled: cancelled,
          pending: pending,
        },
        rates: {
          conversion_rate: parseFloat(conversionRate),
          cancellation_rate: parseFloat(cancellationRate),
          pending_rate: parseFloat(pendingRate),
        },
        dailyTrend: dailyConversion.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stats/cancellations
 * 취소/환불 분석
 */
router.get('/cancellations', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { days = 30 } = req.query;

    // 취소 통계
    const cancellationStats = await db.query(`
      SELECT
        COUNT(*) as total_cancelled,
        AVG(EXTRACT(EPOCH FROM (r.updated_at - r.created_at))/3600) as avg_hours_before_cancel,
        SUM(r.total_amount) as total_refund_amount
      FROM ticket_schema.reservations r
      WHERE r.status = 'cancelled'
        AND r.created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
    `);

    // 시간대별 취소율
    const hourlyCancellation = await db.query(`
      SELECT
        EXTRACT(HOUR FROM r.updated_at) as hour,
        COUNT(*) as cancellations
      FROM ticket_schema.reservations r
      WHERE r.status = 'cancelled'
        AND r.updated_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY EXTRACT(HOUR FROM r.updated_at)
      ORDER BY hour
    `);

    // 이벤트별 취소율
    const eventCancellation = await db.query(`
      SELECT
        e.id,
        e.title,
        COUNT(*) as total_reservations,
        COUNT(*) FILTER (WHERE r.status = 'cancelled') as cancelled,
        ROUND(
          CAST(COUNT(*) FILTER (WHERE r.status = 'cancelled') AS NUMERIC) /
          NULLIF(COUNT(*), 0) * 100,
          2
        ) as cancellation_rate
      FROM ticket_schema.events e
      LEFT JOIN ticket_schema.reservations r ON e.id = r.event_id
      WHERE r.created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY e.id, e.title
      HAVING COUNT(*) > 0
      ORDER BY cancellation_rate DESC
      LIMIT 10
    `);

    // 일별 취소 추이
    const dailyCancellation = await db.query(`
      SELECT
        DATE(r.updated_at) as date,
        COUNT(*) as cancellations
      FROM ticket_schema.reservations r
      WHERE r.status = 'cancelled'
        AND r.updated_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(r.updated_at)
      ORDER BY date DESC
    `);

    res.json({
      success: true,
      data: {
        overview: cancellationStats.rows[0],
        hourlyPattern: hourlyCancellation.rows,
        byEvent: eventCancellation.rows,
        dailyTrend: dailyCancellation.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stats/realtime
 * 실시간 현황
 */
router.get('/realtime', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    // 현재 선택 중인 좌석 (locked)
    const lockedSeats = await db.query(`
      SELECT COUNT(*) as count
      FROM ticket_schema.seats
      WHERE status = 'locked'
    `);

    // 진행 중인 결제 (pending reservations in last 10 minutes)
    const activePayments = await db.query(`
      SELECT COUNT(*) as count
      FROM ticket_schema.reservations
      WHERE status = 'pending'
        AND created_at >= NOW() - INTERVAL '10 minutes'
    `);

    // 최근 1시간 예약 건수
    const lastHourReservations = await db.query(`
      SELECT COUNT(*) as count
      FROM ticket_schema.reservations
      WHERE created_at >= NOW() - INTERVAL '1 hour'
    `);

    // 최근 1시간 매출
    const lastHourRevenue = await db.query(`
      SELECT COALESCE(SUM(total_amount), 0) as revenue
      FROM ticket_schema.reservations
      WHERE created_at >= NOW() - INTERVAL '1 hour'
        AND status = 'confirmed'
    `);

    // 현재 온라인 사용자 (최근 5분 내 활동)
    // Note: 실제로는 session tracking이 필요하지만, 최근 예약 활동으로 추정
    const activeUsers = await db.query(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM ticket_schema.reservations
      WHERE created_at >= NOW() - INTERVAL '5 minutes'
    `);

    // 최근 5분간 분당 예약 건수
    const recentActivity = await db.query(`
      SELECT
        EXTRACT(MINUTE FROM created_at) as minute,
        COUNT(*) as reservations
      FROM ticket_schema.reservations
      WHERE created_at >= NOW() - INTERVAL '5 minutes'
      GROUP BY EXTRACT(MINUTE FROM created_at)
      ORDER BY minute DESC
    `);

    // 현재 가장 인기 있는 이벤트 (최근 1시간)
    const trendingEvents = await db.query(`
      SELECT
        e.id,
        e.title,
        COUNT(r.id) as recent_reservations
      FROM ticket_schema.events e
      JOIN ticket_schema.reservations r ON e.id = r.event_id
      WHERE r.created_at >= NOW() - INTERVAL '1 hour'
      GROUP BY e.id, e.title
      ORDER BY recent_reservations DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        current: {
          locked_seats: parseInt(lockedSeats.rows[0].count),
          active_payments: parseInt(activePayments.rows[0].count),
          active_users: parseInt(activeUsers.rows[0].count),
        },
        lastHour: {
          reservations: parseInt(lastHourReservations.rows[0].count),
          revenue: parseFloat(lastHourRevenue.rows[0].revenue),
        },
        recentActivity: recentActivity.rows,
        trendingEvents: trendingEvents.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stats/seat-preferences
 * 좌석 선호도 분석
 */
router.get('/seat-preferences', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { eventId } = req.query;

    let whereClause = '';
    const params = [];

    if (eventId) {
      whereClause = 'WHERE s.event_id = $1';
      params.push(eventId);
    }

    // 구역별 예약률
    const sectionStats = await db.query(`
      SELECT
        s.section,
        COUNT(DISTINCT s.id) as total_seats,
        COUNT(DISTINCT ri.seat_id) FILTER (WHERE r.status = 'confirmed') as reserved_seats,
        ROUND(
          CAST(COUNT(DISTINCT ri.seat_id) FILTER (WHERE r.status = 'confirmed') AS NUMERIC) /
          NULLIF(COUNT(DISTINCT s.id), 0) * 100,
          2
        ) as reservation_rate
      FROM ticket_schema.seats s
      LEFT JOIN ticket_schema.reservation_items ri ON s.id = ri.seat_id
      LEFT JOIN ticket_schema.reservations r ON ri.reservation_id = r.id
      ${whereClause}
      GROUP BY s.section
      ORDER BY reservation_rate DESC
    `, params);

    // 가격대별 선호도 (좌석의 price 기준)
    const priceStats = await db.query(`
      SELECT
        CASE
          WHEN s.price < 50000 THEN 'budget'
          WHEN s.price < 100000 THEN 'standard'
          WHEN s.price < 150000 THEN 'premium'
          ELSE 'vip'
        END as price_tier,
        COUNT(DISTINCT s.id) as total_seats,
        COUNT(DISTINCT ri.seat_id) FILTER (WHERE r.status = 'confirmed') as reserved_seats,
        ROUND(
          CAST(COUNT(DISTINCT ri.seat_id) FILTER (WHERE r.status = 'confirmed') AS NUMERIC) /
          NULLIF(COUNT(DISTINCT s.id), 0) * 100,
          2
        ) as reservation_rate,
        AVG(s.price) as avg_price
      FROM ticket_schema.seats s
      LEFT JOIN ticket_schema.reservation_items ri ON s.id = ri.seat_id
      LEFT JOIN ticket_schema.reservations r ON ri.reservation_id = r.id
      ${whereClause}
      GROUP BY price_tier
      ORDER BY avg_price
    `, params);

    // 행(row)별 선호도
    const rowStats = await db.query(`
      SELECT
        s.row_number,
        COUNT(DISTINCT s.id) as total_seats,
        COUNT(DISTINCT ri.seat_id) FILTER (WHERE r.status = 'confirmed') as reserved_seats,
        ROUND(
          CAST(COUNT(DISTINCT ri.seat_id) FILTER (WHERE r.status = 'confirmed') AS NUMERIC) /
          NULLIF(COUNT(DISTINCT s.id), 0) * 100,
          2
        ) as reservation_rate
      FROM ticket_schema.seats s
      LEFT JOIN ticket_schema.reservation_items ri ON s.id = ri.seat_id
      LEFT JOIN ticket_schema.reservations r ON ri.reservation_id = r.id
      ${whereClause}
      GROUP BY s.row_number
      ORDER BY reservation_rate DESC
      LIMIT 10
    `, params);

    res.json({
      success: true,
      data: {
        bySection: sectionStats.rows,
        byPriceTier: priceStats.rows,
        topRows: rowStats.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stats/user-behavior
 * 사용자 행동 패턴 분석
 */
router.get('/user-behavior', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { days = 30 } = req.query;

    // 신규 vs 재방문 사용자
    const userTypeStats = await db.query(`
      WITH user_reservation_counts AS (
        SELECT
          user_id,
          COUNT(*) as reservation_count,
          MIN(created_at) as first_reservation
        FROM ticket_schema.reservations
        WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
        GROUP BY user_id
      )
      SELECT
        CASE
          WHEN reservation_count = 1 THEN 'new'
          WHEN reservation_count <= 3 THEN 'returning'
          ELSE 'loyal'
        END as user_type,
        COUNT(*) as user_count,
        SUM(reservation_count) as total_reservations
      FROM user_reservation_counts
      GROUP BY user_type
    `);

    // 사용자당 평균 예약 건수
    const avgReservationsPerUser = await db.query(`
      SELECT
        AVG(reservation_count) as avg_reservations,
        MAX(reservation_count) as max_reservations,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY reservation_count) as median_reservations
      FROM (
        SELECT user_id, COUNT(*) as reservation_count
        FROM ticket_schema.reservations
        WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
        GROUP BY user_id
      ) as user_counts
    `);

    // 평균 예약 금액 분포
    const spendingDistribution = await db.query(`
      SELECT
        CASE
          WHEN avg_amount < 50000 THEN '< 5만원'
          WHEN avg_amount < 100000 THEN '5-10만원'
          WHEN avg_amount < 200000 THEN '10-20만원'
          ELSE '20만원 이상'
        END as spending_tier,
        COUNT(*) as user_count
      FROM (
        SELECT
          user_id,
          AVG(total_amount) as avg_amount
        FROM ticket_schema.reservations
        WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
          AND status = 'confirmed'
        GROUP BY user_id
      ) as user_spending
      GROUP BY spending_tier
      ORDER BY MIN(avg_amount)
    `);

    // 예약 → 결제 완료까지 평균 시간
    const avgTimeToPayment = await db.query(`
      SELECT
        AVG(EXTRACT(EPOCH FROM (r.updated_at - r.created_at))/60) as avg_minutes
      FROM ticket_schema.reservations r
      WHERE r.status = 'confirmed'
        AND r.created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
    `);

    // 요일별 사용자 활동
    const weekdayActivity = await db.query(`
      SELECT
        TO_CHAR(created_at, 'Day') as day_name,
        EXTRACT(DOW FROM created_at) as day_of_week,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) as reservations
      FROM ticket_schema.reservations
      WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY day_name, day_of_week
      ORDER BY day_of_week
    `);

    res.json({
      success: true,
      data: {
        userTypes: userTypeStats.rows,
        averageMetrics: avgReservationsPerUser.rows[0],
        spendingDistribution: spendingDistribution.rows,
        avgTimeToPayment: parseFloat(avgTimeToPayment.rows[0].avg_minutes || 0).toFixed(2),
        weekdayActivity: weekdayActivity.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /stats/performance
 * 성능 메트릭 (시스템 건강도)
 */
router.get('/performance', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    // 데이터베이스 크기
    const dbSize = await db.query(`
      SELECT
        pg_size_pretty(pg_database_size('tiketi')) as db_size,
        pg_database_size('tiketi') as db_size_bytes
    `);

    // 테이블별 레코드 수
    const tableCounts = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM ticket_schema.events) as events,
        (SELECT COUNT(*) FROM ticket_schema.reservations) as reservations,
        (SELECT COUNT(*) FROM ticket_schema.seats) as seats,
        (SELECT COUNT(*) FROM payment_schema.payments) as payments
    `);

    // 최근 1시간 예약 성공률
    const recentSuccessRate = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'confirmed') as successful,
        COUNT(*) FILTER (WHERE status = 'cancelled') as failed,
        ROUND(
          CAST(COUNT(*) FILTER (WHERE status = 'confirmed') AS NUMERIC) /
          NULLIF(COUNT(*), 0) * 100,
          2
        ) as success_rate
      FROM ticket_schema.reservations
      WHERE created_at >= NOW() - INTERVAL '1 hour'
    `);

    // 평균 좌석 잠금 시간 (선택부터 예약 완료까지)
    const avgLockDuration = await db.query(`
      SELECT
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds
      FROM ticket_schema.seats
      WHERE status = 'reserved'
        AND updated_at >= NOW() - INTERVAL '24 hours'
    `);

    // 결제 실패율
    const paymentFailureRate = await db.query(`
      SELECT
        COUNT(*) as total_payments,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_payments,
        ROUND(
          CAST(COUNT(*) FILTER (WHERE status = 'failed') AS NUMERIC) /
          NULLIF(COUNT(*), 0) * 100,
          2
        ) as failure_rate
      FROM payment_schema.payments
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);

    // 시간대별 평균 응답 부하 (예약 건수로 추정)
    const loadByHour = await db.query(`
      SELECT
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as request_count,
        ROUND(COUNT(*)::NUMERIC / 7, 2) as avg_per_day
      FROM ticket_schema.reservations
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `);

    res.json({
      success: true,
      data: {
        database: {
          size: dbSize.rows[0].db_size,
          sizeBytes: parseInt(dbSize.rows[0].db_size_bytes),
          tableCounts: tableCounts.rows[0],
        },
        recentPerformance: {
          successRate: parseFloat(recentSuccessRate.rows[0]?.success_rate || 0),
          totalRequests: parseInt(recentSuccessRate.rows[0]?.total || 0),
        },
        metrics: {
          avgSeatLockSeconds: parseFloat(avgLockDuration.rows[0]?.avg_seconds || 0).toFixed(2),
          paymentFailureRate: parseFloat(paymentFailureRate.rows[0]?.failure_rate || 0),
        },
        loadPattern: loadByHour.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
