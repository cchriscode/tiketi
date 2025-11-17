const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const { initializeAdmin } = require('./config/init-admin');
const initSeats = require('./config/init-seats');
const reservationCleaner = require('./services/reservation-cleaner');
const eventStatusUpdater = require('./services/event-status-updater');
const { initializeSocketIO } = require('./config/socket');
const errorHandler = require('./middleware/error-handler');
const requestLogger = require('./middleware/request-logger');
const { logger } = require('./utils/logger');
const metricsMiddleware = require('./metrics/middleware');
const { register } = require('./metrics');

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger)
app.use(metricsMiddleware);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/seats', require('./routes/seats'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/queue', require('./routes/queue'));

// Image upload route (only if AWS S3 is configured)
if (process.env.AWS_S3_BUCKET) {
  app.use('/api/image', require('./routes/image'));
  console.log('✅ Image upload route enabled (S3 configured)');
} else {
  console.log('⚠️  Image upload route disabled (S3 not configured)');
}

// Health check (enhanced)
app.use('/', require('./routes/health'));

// TODO: 확인용으로 추가. 다음 배포 시 제거할 것
app.get('/error-test', (req, res, next) => {
  const error = new Error('의도적으로 발생시킨 에러입니다!');
  error.status = 400;
  next(error);
});

// Prometheus /metrics 엔드포인트
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    logger.error('❌ Metrics endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Error handling middleware
app.use(errorHandler);

// Initialize Socket.IO with Redis Adapter (AWS multi-instance ready)
const io = initializeSocketIO(server);

// Make io available to routes via app.locals
app.locals.io = io;

server.listen(PORT, async () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📡 Health check: http://localhost:${PORT}/health`);
  logger.info(`📊 Metrics: http://localhost:${PORT}/metrics`);
  logger.info(`🔌 WebSocket ready on port ${PORT}`);

  // Initialize admin account (with retry on database connection failure)
  try {
    await initializeAdmin();
  } catch (error) {
    logger.error('⚠️  Admin initialization will retry on database connection');
  }

  // Initialize seats for events with seat layouts (with retry on database connection failure)
  try {
    await initSeats();
  } catch (error) {
    logger.error('⚠️  Seat initialization will retry on database connection');
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
    logger.warn('⚠️  Shutdown already in progress...');
    return;
  }
  isShuttingDown = true;

  logger.info(`\n📥 Received ${signal}, starting graceful shutdown...`);

  try {
    // 1. Stop accepting new connections
    logger.info('⏸️  Stopping HTTP server (rejecting new connections)...');
    server.close(() => {
      logger.info('✅ HTTP server closed');
    });

    // 2. Stop background services
    logger.info('⏸️  Stopping background services...');
    reservationCleaner.stop();
    eventStatusUpdater.stop();
    logger.info('✅ Background services stopped');

    // 3. Close Socket.IO connections
    logger.info('🔌 Closing WebSocket connections...');
    const io = app.locals.io;
    if (io) {
      io.close(() => {
        logger.info('✅ Socket.IO closed');
      });
    }

    // 4. Wait for ongoing operations (max 5 seconds)
    logger.info('⏳ Waiting for ongoing operations to complete...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 5. Close database connections
    logger.info('💾 Closing database connections...');
    const db = require('./config/database');
    const pool = db.getClient ? await db.getClient() : null;
    if (pool) {
      await pool.end();
    }
    logger.info('✅ Database connections closed');

    // 6. Close Redis connections
    logger.info('🗄️  Closing Redis connections...');
    const { client: redisClient } = require('./config/redis');
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
    }
    logger.info('✅ Redis connections closed');

    logger.info('✨ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Graceful shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

