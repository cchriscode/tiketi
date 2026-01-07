/**
 * Ticket Service - Main Server
 */

require('dotenv').config();

// ============================================================================
// CRITICAL: Environment Variable Validation (Production)
// ============================================================================
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = [
    'JWT_SECRET',
    'INTERNAL_API_TOKEN',
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    console.error('❌ CRITICAL: Missing required environment variables in production:');
    console.error(`   ${missing.join(', ')}`);
    console.error('');
    console.error('   Generate secrets with: openssl rand -base64 32');
    process.exit(1);
  }

  console.log('✅ Production environment variables validated');
}

const express = require('express');
const http = require('http');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { client: redisClient } = require('./config/redis');
const { errorHandler } = require('@tiketi/common');
const { metricsMiddleware, register } = require('@tiketi/metrics');

// Routes
const eventsRoutes = require('./routes/events');
const ticketsRoutes = require('./routes/tickets');
const seatsRoutes = require('./routes/seats');
const queueRoutes = require('./routes/queue');
const reservationsRoutes = require('./routes/reservations');
const internalRoutes = require('./routes/internal');

// Background Services
const queueProcessor = require('./services/queue-processor');
const reservationCleaner = require('./services/reservation-cleaner');
const eventStatusUpdater = require('./services/event-status-updater');

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

// Apply Redis adapter for multi-pod support (pub/sub) only if Redis is enabled
// This allows WebSocket events to be broadcasted across multiple pods in EKS
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisEnabled = redisHost !== 'localhost' && redisHost !== 'disabled-redis';

if (redisEnabled) {
  try {
    const Redis = require('ioredis');
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = process.env.REDIS_PORT || 6379;
    const redisPassword = process.env.REDIS_PASSWORD;

    const pubClient = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      enableOfflineQueue: false,
    });

    const subClient = pubClient.duplicate();

    Promise.all([
      pubClient.connect(),
      subClient.connect()
    ]).then(() => {
      try {
        io.adapter(createAdapter(pubClient, subClient));
        console.log('✅ Socket.IO Redis adapter connected (multi-pod ready)');
      } catch (err) {
        console.log('⚠️  Socket.IO adapter creation failed, continuing in standalone mode:', err.message);
        if (pubClient && pubClient.disconnect) pubClient.disconnect().catch(() => {});
        if (subClient && subClient.disconnect) subClient.disconnect().catch(() => {});
      }
    }).catch(err => {
      console.log('⚠️  Socket.IO running without Redis adapter (connection failed):', err.message);
      if (pubClient && pubClient.disconnect) pubClient.disconnect().catch(() => {});
      if (subClient && subClient.disconnect) subClient.disconnect().catch(() => {});
    });
  } catch (err) {
    console.log('⚠️  Socket.IO Redis adapter initialization failed:', err.message);
    console.log('ℹ️  Socket.IO running in standalone mode');
  }
} else {
  console.log('ℹ️  Socket.IO running in standalone mode (Redis disabled)');
}

// Make io available to routes
app.locals.io = io;

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    console.log('❌ Socket connection rejected: No token provided');
    return next(new Error('Authentication required'));
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-in-production-f8a7b6c5d4e3f2a1';
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded; // Attach user info to socket
    console.log(`✅ Socket authenticated: ${decoded.email} (${socket.id})`);
    next();
  } catch (error) {
    console.log('❌ Socket authentication failed:', error.message);
    return next(new Error('Invalid token'));
  }
});

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
app.use('/api/events', eventsRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/seats', seatsRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/reservations', reservationsRoutes);

// Internal API (for inter-service communication)
app.use('/internal', internalRoutes);

// Error handler (must be last)
app.use(errorHandler);

// WebSocket connection handler
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  socket.on('join-event', (data) => {
    const eventId = typeof data === 'object' ? data.eventId : data;
    socket.join(`event:${eventId}`);
    console.log(`📍 Client ${socket.id} joined event:${eventId}`);

    // Emit room info to the client
    const room = io.sockets.adapter.rooms.get(`event:${eventId}`);
    const userCount = room ? room.size : 0;
    socket.emit('room-info', { userCount });
  });

  socket.on('join-queue', (data) => {
    const eventId = typeof data === 'object' ? data.eventId : data;
    socket.join(`queue:${eventId}`);
    console.log(`⏳ Client ${socket.id} joined queue:${eventId}`);
  });

  socket.on('join-seat-selection', (data) => {
    const eventId = typeof data === 'object' ? data.eventId : data;
    socket.join(`seats:${eventId}`);
    console.log(`🎫 Client ${socket.id} joined seat selection for event:${eventId}`);
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
  queueProcessor.setIO(io);
  queueProcessor.start();
  reservationCleaner.setIO(io);
  reservationCleaner.start();
  eventStatusUpdater.setIO(io);
  eventStatusUpdater.start();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  queueProcessor.stop();
  reservationCleaner.stop();
  eventStatusUpdater.stop();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  queueProcessor.stop();
  reservationCleaner.stop();
  eventStatusUpdater.stop();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = app;
