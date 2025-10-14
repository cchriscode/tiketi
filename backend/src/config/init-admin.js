const bcrypt = require('bcrypt');
const db = require('./database');

async function initializeAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await db.query(
      'SELECT id FROM users WHERE email = $1',
      ['admin@tiketi.gg']
    );

    if (existingAdmin.rows.length > 0) {
      console.log('✅ Admin account already exists');
      return;
    }

    // Create admin account
    const password = 'admin123';
    const passwordHash = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO users (email, password_hash, name, phone, role) 
       VALUES ($1, $2, $3, $4, $5)`,
      ['admin@tiketi.gg', passwordHash, '관리자', '010-1234-5678', 'admin']
    );

    console.log('✅ Admin account created successfully');
    console.log('   Email: admin@tiketi.gg');
    console.log('   Password: admin123');
  } catch (error) {
    console.error('❌ Failed to initialize admin account:', error.message);
  }
}

module.exports = { initializeAdmin };

