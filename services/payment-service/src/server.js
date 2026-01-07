/**
 * Payment Service - Main Server
 * TossPayments API 연동
 */

require('dotenv').config();

// ============================================================================
// CRITICAL: Environment Variable Validation (Production)
// ============================================================================
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = [
    'JWT_SECRET',
    'TOSS_SECRET_KEY',
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
  console.log('💳 Payment Service v1.0.1 - CI/CD test');
}

const express = require('express');
const cors = require('cors');
const { errorHandler } = require('@tiketi/common');
const { metricsMiddleware, register } = require('@tiketi/metrics');

// Routes
const paymentsRoutes = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware('payment-service'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'payment-service',
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Routes
app.use('/api/payments', paymentsRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Payment Service running on port ${PORT}`);
  console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`❤️  Health: http://localhost:${PORT}/health`);
  console.log(`💳 TossPayments integration enabled`);
});

module.exports = app;
