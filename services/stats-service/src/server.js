const express = require('express');
const cors = require('cors');
const statsRoutes = require('./routes/stats');
const { errorHandler, logger } = require('@tiketi/common');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.logRequest(req);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'stats-service', version: 'v1' });
});

app.use('/api/v1/stats', statsRoutes);
app.use(errorHandler);

app.use((req, res) => {
  logger.warn(`❌ 404: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  logger.info(`🚀 Stats Service running on port ${PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV || 'production'}`);
});

module.exports = app;
