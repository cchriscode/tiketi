const bcrypt = require('bcrypt');
const db = require('./database');
const { CONFIG, logger } = require('@tiketi/common');

async function initializeAdmin() {
  try {
    // Check if admin exists
    const result = await db.pool.query(
      'SELECT id FROM users WHERE email = $1',
      [CONFIG.DEFAULT_ADMIN_EMAIL]
    );

    if (result.rows.length > 0) {
      logger.info('✅ Admin user already exists');
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash(
      CONFIG.DEFAULT_ADMIN_PASSWORD,
      CONFIG.BCRYPT_SALT_ROUNDS
    );

    await db.pool.query(
      `INSERT INTO users (email, password_hash, name, phone, role)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        CONFIG.DEFAULT_ADMIN_EMAIL,
        hashedPassword,
        CONFIG.DEFAULT_ADMIN_NAME,
        CONFIG.DEFAULT_ADMIN_PHONE,
        'admin',
      ]
    );

    logger.info('✅ Admin user created successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize admin:', error);
    throw error;
  }
}

module.exports = { initializeAdmin };
