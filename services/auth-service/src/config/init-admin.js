const bcrypt = require('bcrypt');
const db = require('./database');
const { CONFIG } = require('../utils/constants');
const { logger } = require('../utils/logger');

async function initializeAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [CONFIG.DEFAULT_ADMIN_EMAIL]
    );

    if (existingAdmin.rows.length > 0) {
      logger.info('✅ Admin account already exists');
      return;
    }

    // Create admin account
    const passwordHash = await bcrypt.hash(
      CONFIG.DEFAULT_ADMIN_PASSWORD,
      CONFIG.BCRYPT_SALT_ROUNDS
    );

    await db.query(
      `INSERT INTO users (email, password_hash, name, phone, role) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        CONFIG.DEFAULT_ADMIN_EMAIL,
        passwordHash,
        CONFIG.DEFAULT_ADMIN_NAME,
        CONFIG.DEFAULT_ADMIN_PHONE,
        'admin'
      ]
    );

    logger.info(`✅ Admin account created successfully
      Email: ${CONFIG.DEFAULT_ADMIN_EMAIL}
      Password: ${CONFIG.DEFAULT_ADMIN_PASSWORD}`);
  } catch (error) {
    logger.error('❌ Failed to initialize admin account:', error.message);
  }
}

module.exports = { initializeAdmin };
