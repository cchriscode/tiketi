const bcrypt = require('bcrypt');

async function generateHash() {
  const password = 'admin123';
  const hash = await bcrypt.hash(password, 10);
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\nSQL:');
  console.log(`INSERT INTO users (email, password_hash, name, phone, role) VALUES`);
  console.log(`('admin@tiketi.gg', '${hash}', '관리자', '010-1234-5678', 'admin');`);
}

generateHash();

