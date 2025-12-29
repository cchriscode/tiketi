/**
 * Stats Service - Main Server
 * 통계 및 대시보드 API
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { errorHandler } = require('@tiketi/common');
const { metricsMiddleware, register } = require('@tiketi/metrics');

// Routes
const statsRoutes = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware('stats-service'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'stats-service',
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Routes
app.use('/stats', statsRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Stats Service running on port ${PORT}`);
  console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`❤️  Health: http://localhost:${PORT}/health`);
  console.log(`📈 Stats API: http://localhost:${PORT}/stats`);
});

module.exports = app;
