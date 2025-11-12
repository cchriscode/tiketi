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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

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

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  reservationCleaner.stop();
  eventStatusUpdater.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  reservationCleaner.stop();
  eventStatusUpdater.stop();
  process.exit(0);
});

