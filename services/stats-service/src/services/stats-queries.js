/**
 * Stats Queries Service
 * Handles all statistics and aggregation queries
 */

const db = require('../config/database');
const { RESERVATION_STATUS, PAYMENT_STATUS, GRANULARITY } = require('../shared/constants');

/**
 * Get dashboard summary statistics
 * @returns {Promise<Object>} Dashboard stats object
 */
async function getDashboardStats() {
  // Total events
  const eventsResult = await db.query('SELECT COUNT(*) as count FROM events');
  const totalEvents = parseInt(eventsResult.rows[0].count);

  // Total reservations (non-cancelled)
  const reservationsResult = await db.query(
    'SELECT COUNT(*) as count FROM reservations WHERE status != $1',
    [RESERVATION_STATUS.CANCELLED]
  );
  const totalReservations = parseInt(reservationsResult.rows[0].count);

  // Total revenue (completed payments only)
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

  return {
    totalEvents,
    totalReservations,
    totalRevenue,
    todayReservations,
  };
}

/**
 * Get recent reservations
 * @param {number} limit Number of recent reservations to return
 * @returns {Promise<Array>} Array of recent reservations
 */
async function getRecentReservations(limit = 10) {
  const result = await db.query(
    `SELECT 
      r.id, r.reservation_number, r.total_amount, r.status, r.created_at,
      u.name as user_name, u.email as user_email,
      e.title as event_title
    FROM reservations r
    JOIN users u ON r.user_id = u.id
    JOIN events e ON r.event_id = e.id
    ORDER BY r.created_at DESC
    LIMIT $1`,
    [limit]
  );

  return result.rows;
}

/**
 * Get event-specific statistics
 * @param {string} eventId Event ID
 * @returns {Promise<Object>} Event statistics
 */
async function getEventStats(eventId) {
  // Event details
  const eventResult = await db.query(
    'SELECT id, title, event_date, venue FROM events WHERE id = $1',
    [eventId]
  );

  if (eventResult.rows.length === 0) {
    throw new Error('Event not found');
  }

  const event = eventResult.rows[0];

  // Event reservations (total and by status)
  const reservationStatsResult = await db.query(
    `SELECT 
      status,
      COUNT(*) as count,
      COALESCE(SUM(total_amount), 0) as revenue
    FROM reservations
    WHERE event_id = $1
    GROUP BY status`,
    [eventId]
  );

  const reservationsByStatus = {};
  let totalEventReservations = 0;
  let totalEventRevenue = 0;

  for (const row of reservationStatsResult.rows) {
    reservationsByStatus[row.status] = {
      count: parseInt(row.count),
      revenue: parseInt(row.revenue),
    };
    totalEventReservations += parseInt(row.count);
    totalEventRevenue += parseInt(row.revenue);
  }

  // Ticket availability (by ticket type)
  const ticketStatsResult = await db.query(
    `SELECT 
      tt.id,
      tt.name,
      tt.price,
      tt.total_quantity,
      (tt.total_quantity - COALESCE(SUM(ri.quantity), 0)) as available_quantity,
      COALESCE(SUM(ri.quantity), 0) as sold_quantity
    FROM ticket_types tt
    LEFT JOIN reservation_items ri ON tt.id = ri.ticket_type_id 
      AND ri.reservation_id IN (
        SELECT id FROM reservations 
        WHERE event_id = $1 AND status != $2
      )
    WHERE tt.event_id = $1
    GROUP BY tt.id, tt.name, tt.price, tt.total_quantity`,
    [eventId, RESERVATION_STATUS.CANCELLED]
  );

  const ticketStats = ticketStatsResult.rows.map(row => ({
    id: row.id,
    name: row.name,
    price: parseInt(row.price),
    totalQuantity: parseInt(row.total_quantity),
    availableQuantity: parseInt(row.available_quantity),
    soldQuantity: parseInt(row.sold_quantity),
    sellPercentage: Math.round(
      (parseInt(row.sold_quantity) / parseInt(row.total_quantity)) * 100
    ),
  }));

  return {
    event,
    reservations: {
      total: totalEventReservations,
      byStatus: reservationsByStatus,
      totalRevenue: totalEventRevenue,
    },
    tickets: ticketStats,
  };
}

/**
 * Get revenue statistics by period
 * @param {string} granularity daily, weekly, or monthly
 * @param {string} startDate Start date (YYYY-MM-DD)
 * @param {string} endDate End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Revenue statistics grouped by period
 */
async function getRevenueStats(granularity = GRANULARITY.DAILY, startDate, endDate) {
  let dateFormat;
  switch (granularity) {
    case GRANULARITY.WEEKLY:
      dateFormat = "to_char(DATE(created_at), 'YYYY-WW')";
      break;
    case GRANULARITY.MONTHLY:
      dateFormat = "to_char(DATE(created_at), 'YYYY-MM')";
      break;
    case GRANULARITY.DAILY:
    default:
      dateFormat = "DATE(created_at)::text";
  }

  const query = `
    SELECT 
      ${dateFormat} as period,
      COUNT(*) as reservation_count,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      AVG(total_amount) as avg_price,
      COUNT(DISTINCT user_id) as unique_users
    FROM reservations
    WHERE 
      payment_status = $1 
      AND DATE(created_at) BETWEEN $2 AND $3
    GROUP BY period
    ORDER BY period DESC
  `;

  const result = await db.query(query, [PAYMENT_STATUS.COMPLETED, startDate, endDate]);

  return result.rows.map(row => ({
    period: row.period,
    reservationCount: parseInt(row.reservation_count),
    totalRevenue: parseInt(row.total_revenue),
    avgPrice: parseFloat(row.avg_price).toFixed(0),
    uniqueUsers: parseInt(row.unique_users),
  }));
}

/**
 * Get top events by revenue or reservations
 * @param {string} metric revenue or reservations
 * @param {number} limit Number of events to return
 * @returns {Promise<Array>} Top events
 */
async function getTopEvents(metric = 'revenue', limit = 10) {
  let orderBy, selectField;

  if (metric === 'reservations') {
    selectField = 'COUNT(*) as metric_value';
    orderBy = 'COUNT(*) DESC';
  } else {
    selectField = 'COALESCE(SUM(total_amount), 0) as metric_value';
    orderBy = 'COALESCE(SUM(total_amount), 0) DESC';
  }

  const query = `
    SELECT 
      e.id,
      e.title,
      e.event_date,
      e.venue,
      COUNT(DISTINCT r.id) as total_reservations,
      COALESCE(SUM(r.total_amount), 0) as total_revenue
    FROM events e
    LEFT JOIN reservations r ON e.id = r.event_id 
      AND r.status != $1 
      AND r.payment_status = $2
    GROUP BY e.id, e.title, e.event_date, e.venue
    ORDER BY ${orderBy}
    LIMIT $3
  `;

  const result = await db.query(query, [
    RESERVATION_STATUS.CANCELLED,
    PAYMENT_STATUS.COMPLETED,
    limit
  ]);

  return result.rows.map(row => ({
    id: row.id,
    title: row.title,
    eventDate: row.event_date,
    venue: row.venue,
    totalReservations: parseInt(row.total_reservations),
    totalRevenue: parseInt(row.total_revenue),
  }));
}

/**
 * Get payment method distribution
 * @returns {Promise<Array>} Payment method statistics
 */
async function getPaymentMethodStats() {
  const result = await db.query(
    `SELECT 
      payment_method,
      COUNT(*) as count,
      COALESCE(SUM(total_amount), 0) as total_revenue
    FROM reservations
    WHERE payment_status = $1 AND payment_method IS NOT NULL
    GROUP BY payment_method
    ORDER BY count DESC`,
    [PAYMENT_STATUS.COMPLETED]
  );

  return result.rows.map(row => ({
    paymentMethod: row.payment_method,
    count: parseInt(row.count),
    totalRevenue: parseInt(row.total_revenue),
  }));
}

module.exports = {
  getDashboardStats,
  getRecentReservations,
  getEventStats,
  getRevenueStats,
  getTopEvents,
  getPaymentMethodStats,
};
