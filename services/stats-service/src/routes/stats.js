/**
 * Stats Router
 * Handles all statistics and reporting API endpoints
 */

const express = require('express');
const { authenticateToken, requireAdmin } = require('@tiketi/common');
const statsQueries = require('../services/stats-queries');
const { logger } = require('@tiketi/common');
const { CustomError } = require('@tiketi/common');
const { GRANULARITY, ERROR_MESSAGES } = require('@tiketi/common');

const router = express.Router();

/**
 * GET /api/v1/stats/dashboard
 * Get dashboard summary statistics
 */
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const stats = await statsQueries.getDashboardStats();
    const recentReservations = await statsQueries.getRecentReservations(10);

    res.json({
      stats,
      recentReservations,
    });
  } catch (error) {
    logger.error('Dashboard stats error:', error);
    next(new CustomError(500, ERROR_MESSAGES.DATABASE_ERROR, error));
  }
});

/**
 * GET /api/v1/stats/events/:eventId
 * Get event-specific statistics
 */
router.get('/events/:eventId', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const eventStats = await statsQueries.getEventStats(eventId);

    res.json(eventStats);
  } catch (error) {
    if (error.message === 'Event not found') {
      next(new CustomError(404, 'Event not found'));
    } else {
      logger.error('Event stats error:', error);
      next(new CustomError(500, ERROR_MESSAGES.DATABASE_ERROR, error));
    }
  }
});

/**
 * GET /api/v1/stats/revenue
 * Get revenue statistics by period
 * Query params: granularity (daily|weekly|monthly), startDate, endDate
 */
router.get('/revenue', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { granularity = GRANULARITY.DAILY, startDate, endDate } = req.query;

    // Validate query parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDate and endDate are required',
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return res.status(400).json({
        error: ERROR_MESSAGES.INVALID_DATE_RANGE,
      });
    }

    // Validate granularity
    if (!Object.values(GRANULARITY).includes(granularity)) {
      return res.status(400).json({
        error: 'Invalid granularity. Must be daily, weekly, or monthly',
      });
    }

    const revenueStats = await statsQueries.getRevenueStats(
      granularity,
      startDate,
      endDate
    );

    res.json({
      granularity,
      startDate,
      endDate,
      data: revenueStats,
    });
  } catch (error) {
    logger.error('Revenue stats error:', error);
    next(new CustomError(500, ERROR_MESSAGES.DATABASE_ERROR, error));
  }
});

/**
 * GET /api/v1/stats/top-events
 * Get top events by revenue or reservations
 * Query params: metric (revenue|reservations), limit (default: 10)
 */
router.get('/top-events', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { metric = 'revenue', limit = 10 } = req.query;

    // Validate metric
    if (!['revenue', 'reservations'].includes(metric)) {
      return res.status(400).json({
        error: 'Invalid metric. Must be revenue or reservations',
      });
    }

    // Validate limit
    const limitNum = Math.min(parseInt(limit) || 10, 100);

    const topEvents = await statsQueries.getTopEvents(metric, limitNum);

    res.json({
      metric,
      limit: limitNum,
      data: topEvents,
    });
  } catch (error) {
    logger.error('Top events stats error:', error);
    next(new CustomError(500, ERROR_MESSAGES.DATABASE_ERROR, error));
  }
});

/**
 * GET /api/v1/stats/payment-methods
 * Get payment method distribution
 */
router.get('/payment-methods', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const paymentStats = await statsQueries.getPaymentMethodStats();

    res.json({
      data: paymentStats,
    });
  } catch (error) {
    logger.error('Payment method stats error:', error);
    next(new CustomError(500, ERROR_MESSAGES.DATABASE_ERROR, error));
  }
});

module.exports = router;
