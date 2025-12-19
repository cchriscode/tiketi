/**
 * Stats Service - Main Server
 * Handles statistics, aggregation, and reporting
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/database');
const { logger } = require('./utils/logger');
const errorHandler = require('./middleware/error-handler');
const requestLogger = require('./middleware/request-logger');

// Routes
const statsRouter = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'stats-service' });
});

// API Routes (with /api/v1 prefix)
app.use('/api/v1/stats', statsRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error Handler (must be last)
app.use(errorHandler);

// Server startup
const server = app.listen(PORT, () => {
  logger.info(`🚀 Stats Service running on port ${PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
const gracefulShutdown = () => {
  logger.info('⏹️  Shutting down Stats Service...');
  server.close(async () => {
    try {
      await db.pool.end();
      logger.info('✅ Database connections closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error closing database:', error);
      process.exit(1);
    }
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

module.exports = app;
