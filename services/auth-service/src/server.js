const express = require('express');
const authRoutes = require('./routes');
const errorHandler = require('./middleware/error-handler');
const { logger } = require('./utils/logger');
const { initializeAdmin } = require('./config/init-admin');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize admin account
initializeAdmin().catch(err => {
  logger.error('Failed to initialize admin:', err);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

// API Routes
app.use('/api/auth', authRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = app;
