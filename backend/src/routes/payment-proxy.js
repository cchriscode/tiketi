/**
 * Payment Service Proxy
 * Proxies /api/payments requests to Payment Service (port 3003)
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3003';

// Proxy all /api/payments requests to Payment Service
// Matches both /api/payments and /api/payments/* routes
router.all('*', async (req, res) => {
  try {
    // Use baseUrl + path to construct full target URL
    const targetUrl = `${PAYMENT_SERVICE_URL}${req.baseUrl}${req.path}`;

    // Forward the request with same method, headers, and body
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        ...req.headers,
        host: 'payment-service:3003', // Override host header
      },
      data: req.body,
      params: req.query,
      validateStatus: () => true, // Accept all status codes
    });

    // Forward the response
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(`Payment Service proxy error (${req.baseUrl}${req.path}): ${error.message}`);
    res.status(503).json({
      error: 'Payment Service unavailable',
      message: error.message,
    });
  }
});

module.exports = router;
