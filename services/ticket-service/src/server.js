const express = require('express');
const cors = require('cors');
const http = require('http');
const { initializeSocketIO } = require('./config/socket');
const { errorHandler, logger } = require('@tiketi/common');

const app = express();
const server = http.createServer(app);

const io = initializeSocketIO(server);
app.set('io', io);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  logger.logRequest(req);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ticket-service', version: 'v1' });
});

app.use('/api/v1/events', require('./routes/events'));
app.use('/api/v1/tickets', require('./routes/tickets'));
app.use('/api/v1/reservations', require('./routes/reservations'));
app.use('/api/v1/seats', require('./routes/seats'));
app.use('/api/v1/queue', require('./routes/queue'));
app.use('/api/v1/news', require('./routes/news'));

app.use(errorHandler);

const PORT = process.env.PORT || 3002;

server.listen(PORT, () => {
  logger.info(`🚀 Ticket Service running on port ${PORT}`);
});

module.exports = { app, server, io };
