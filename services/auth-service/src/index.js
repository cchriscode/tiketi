const app = require('./server');
const { logger } = require('@tiketi/common');

const PORT = process.env.PORT || 3010;

app.listen(PORT, () => {
  logger.info(`🚀 Auth Service running on port ${PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV || 'production'}`);
});
