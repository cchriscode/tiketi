const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const { initializeAdmin } = require('./config/init-admin');
const initSeats = require('./config/init-seats');
const reservationCleaner = require('./services/reservation-cleaner');
const eventStatusUpdater = require('./services/event-status-updater');
const { initializeSocketIO } = require('./config/socket');

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/seats', require('./routes/seats'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/queue', require('./routes/queue'));
app.use('/api/image', require('./routes/image'));

// Health check (enhanced)
app.use('/', require('./routes/health'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
    }
  });
});

// Initialize Socket.IO with Redis Adapter (AWS multi-instance ready)
const io = initializeSocketIO(server);

// Make io available to routes via app.locals
app.locals.io = io;

server.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket ready on port ${PORT}`);

  // Initialize admin account (with retry on database connection failure)
  try {
    await initializeAdmin();
  } catch (error) {
    console.error('⚠️  Admin initialization will retry on database connection');
  }

  // Initialize seats for events with seat layouts (with retry on database connection failure)
  try {
    await initSeats();
  } catch (error) {
    console.error('⚠️  Seat initialization will retry on database connection');
  }

  // Set Socket.IO for reservation cleaner (real-time seat release)
  reservationCleaner.setIO(io);

  // Start reservation cleaner
  reservationCleaner.start();

  // Start event status updater
  eventStatusUpdater.start();
});

// ========================================
// Graceful Shutdown Handler (Enhanced)
// ========================================
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log('⚠️  Shutdown already in progress...');
    return;
  }
  isShuttingDown = true;

  console.log(`\n📥 Received ${signal}, starting graceful shutdown...`);

  try {
    // 1. Stop accepting new connections
    console.log('⏸️  Stopping HTTP server (rejecting new connections)...');
    server.close(() => {
      console.log('✅ HTTP server closed');
    });

    // 2. Stop background services
    console.log('⏸️  Stopping background services...');
    reservationCleaner.stop();
    eventStatusUpdater.stop();
    console.log('✅ Background services stopped');

    // 3. Close Socket.IO connections
    console.log('🔌 Closing WebSocket connections...');
    const io = app.locals.io;
    if (io) {
      io.close(() => {
        console.log('✅ Socket.IO closed');
      });
    }

    // 4. Wait for ongoing operations (max 30 seconds)
    console.log('⏳ Waiting for ongoing operations to complete...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 5. Close database connections
    console.log('💾 Closing database connections...');
    const db = require('./config/database');
    const pool = db.getClient ? await db.getClient() : null;
    if (pool) {
      await pool.end();
    }
    console.log('✅ Database connections closed');

    // 6. Close Redis connections
    console.log('🗄️  Closing Redis connections...');
    const { client: redisClient } = require('./config/redis');
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
    }
    console.log('✅ Redis connections closed');

    console.log('✨ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Graceful shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

