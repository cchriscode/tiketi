/**
 * Ticket Service - Main Entry Point
 * 
 * Responsible for:
 * - Event/Ticket/Seat/Reservation Management
 * - Queue System (Redis-based)
 * - Socket.IO for real-time updates
 */

const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const { initializeSocketIO } = require('./config/socket');
const errorHandler = require('./middleware/error-handler');
const requestLogger = require('./middleware/request-logger');
const { logger } = require('./utils/logger');

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ticket-service' });
});

// Routes - API v1
app.use('/api/v1/events', require('./routes/events'));
app.use('/api/v1/tickets', require('./routes/tickets'));
app.use('/api/v1/reservations', require('./routes/reservations'));
app.use('/api/v1/seats', require('./routes/seats'));
app.use('/api/v1/queue', require('./routes/queue'));

// Error handling middleware
app.use(errorHandler);

// Initialize Socket.IO with Redis Adapter
const io = initializeSocketIO(server);

// Make io available to routes
app.locals.io = io;

server.listen(PORT, () => {
  logger.info(`🚀 Ticket Service running on port ${PORT}`);
  logger.info(`📡 Health check: http://localhost:${PORT}/health`);
  logger.info(`🔌 WebSocket ready on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
