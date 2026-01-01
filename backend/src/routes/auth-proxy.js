/**
 * Auth Service Proxy
 * Proxies /api/auth requests to Auth Service (port 3005)
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3005';

// Proxy all /api/auth requests to Auth Service
// Matches both /api/auth and /api/auth/* routes
router.all('*', async (req, res) => {
  try {
    // Use baseUrl + path to construct full target URL
    const targetUrl = `${AUTH_SERVICE_URL}${req.baseUrl}${req.path}`;

    // Forward the request with same method, headers, and body
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        ...req.headers,
        host: 'auth-service:3005', // Override host header
      },
      data: req.body,
      params: req.query,
      validateStatus: () => true, // Accept all status codes
    });

    // Forward the response
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(`Auth Service proxy error (${req.baseUrl}${req.path}): ${error.message}`);
    res.status(503).json({
      error: 'Auth Service unavailable',
      message: error.message,
    });
  }
});

module.exports = router;
