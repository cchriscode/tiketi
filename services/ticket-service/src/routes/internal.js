/**
 * Internal API Routes - For inter-service communication only
 * Not exposed to public, used by backend/other services
 */

const express = require('express');
const router = express.Router();

// Internal authentication middleware
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN || 'dev-internal-token-change-in-production';

const authenticateInternal = (req, res, next) => {
  const token = req.headers['x-internal-token'];

  if (!token || token !== INTERNAL_TOKEN) {
    return res.status(403).json({ error: 'Forbidden: Invalid internal token' });
  }

  next();
};

/**
 * POST /internal/reschedule-event-status
 * Reschedule event status updater (called when admin creates/updates events)
 */
router.post('/reschedule-event-status', authenticateInternal, (req, res) => {
  try {
    const eventStatusUpdater = require('../services/event-status-updater');

    // Trigger reschedule (non-blocking)
    eventStatusUpdater.reschedule();

    console.log('✅ Event status updater rescheduled via internal API');

    res.json({
      success: true,
      message: 'Event status updater rescheduled'
    });
  } catch (error) {
    console.error('❌ Failed to reschedule event status updater:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reschedule event status updater'
    });
  }
});

module.exports = router;
