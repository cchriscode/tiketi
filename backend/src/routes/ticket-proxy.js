/**
 * Ticket Service Proxy
 * Proxies ticket-related requests to Ticket Service (port 3002)
 * Handles: /api/events, /api/tickets, /api/seats, /api/reservations, /api/queue
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

const TICKET_SERVICE_URL = process.env.TICKET_SERVICE_URL || 'http://ticket-service:3002';

// Proxy all requests to ticket service
// This router is mounted on multiple paths in server.js:
// - /api/events, /api/tickets, /api/seats, /api/reservations, /api/queue
// We use req.baseUrl to determine which service path to forward to
router.all('*', async (req, res) => {
  try {
    // Combine baseUrl (e.g., '/api/events') with path (e.g., '/123' or '/')
    const targetUrl = `${TICKET_SERVICE_URL}${req.baseUrl}${req.path}`;

    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        ...req.headers,
        host: 'ticket-service:3002',
      },
      data: req.body,
      params: req.query,
      validateStatus: () => true,
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(`Ticket Service proxy error (${req.baseUrl}${req.path}): ${error.message}`);
    res.status(503).json({
      error: 'Ticket Service unavailable',
      message: error.message,
    });
  }
});

module.exports = router;
