const bcrypt = require('bcrypt');
const db = require('./database');
const { CONFIG } = require('../shared/constants');

async function initializeAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [CONFIG.DEFAULT_ADMIN_EMAIL]
    );

    if (existingAdmin.rows.length > 0) {
      console.log('✅ Admin account already exists');
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

    console.log('✅ Admin account created successfully');
    console.log(`   Email: ${CONFIG.DEFAULT_ADMIN_EMAIL}`);
    console.log(`   Password: ${CONFIG.DEFAULT_ADMIN_PASSWORD}`);
  } catch (error) {
    console.error('❌ Failed to initialize admin account:', error.message);
  }
}

module.exports = { initializeAdmin };

