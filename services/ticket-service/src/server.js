/**
 * Ticket Service - Main Server
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { errorHandler } = require('@tiketi/common');
const { metricsMiddleware, register } = require('@tiketi/metrics');

// Routes
const eventsRoutes = require('./routes/events');
const ticketsRoutes = require('./routes/tickets');
const seatsRoutes = require('./routes/seats');
const queueRoutes = require('./routes/queue');

// Background Services
const queueProcessor = require('./services/queue-processor');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3002;

// WebSocket setup
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_IO_CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
  path: process.env.SOCKET_IO_PATH || '/socket.io',
});

// Make io available to routes
app.locals.io = io;

// Middleware
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware('ticket-service'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ticket-service',
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Routes
app.use('/events', eventsRoutes);
app.use('/tickets', ticketsRoutes);
app.use('/seats', seatsRoutes);
app.use('/queue', queueRoutes);

// Error handler (must be last)
app.use(errorHandler);

// WebSocket connection handler
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  socket.on('join-event', (eventId) => {
    socket.join(`event:${eventId}`);
    console.log(`📍 Client ${socket.id} joined event:${eventId}`);
  });

  socket.on('join-queue', (eventId) => {
    socket.join(`queue:${eventId}`);
    console.log(`⏳ Client ${socket.id} joined queue:${eventId}`);
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Ticket Service running on port ${PORT}`);
  console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`❤️  Health: http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket enabled`);

  // Start background services
  queueProcessor.start();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  queueProcessor.stop();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  queueProcessor.stop();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = app;
