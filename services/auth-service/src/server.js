const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes');
const { errorHandler, logger } = require('@tiketi/common');
const { initializeAdmin } = require('./config/init-admin');

const app = express();

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 새로운 공통 라이브러리 기능 사용!
app.use((req, res, next) => {
  logger.logRequest(req);
  next();
});

initializeAdmin().catch(err => {
  logger.error('❌ Failed to initialize admin account:', err);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service', version: 'v1' });
});

app.use('/api/v1/auth', authRoutes);
app.use(errorHandler);

app.use((req, res) => {
  logger.warn(`❌ 404: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Not found' });
});

module.exports = app;
