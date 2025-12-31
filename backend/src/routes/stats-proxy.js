/**
 * Stats Service Proxy
 * Proxies /api/stats requests to Stats Service (port 3004)
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

const STATS_SERVICE_URL = process.env.STATS_SERVICE_URL || 'http://stats-service:3004';

// Proxy all /api/stats/* requests to Stats Service
router.all('/*', async (req, res) => {
  try {
    const targetUrl = `${STATS_SERVICE_URL}/api/stats${req.path}`;

    // Forward the request with same method, headers, and body
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        ...req.headers,
        host: 'stats-service:3004', // Override host header
      },
      data: req.body,
      params: req.query,
      validateStatus: () => true, // Accept all status codes
    });

    // Forward the response
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(`Stats Service proxy error: ${error.message}`);
    res.status(503).json({
      error: 'Stats Service unavailable',
      message: error.message,
    });
  }
});

module.exports = router;
