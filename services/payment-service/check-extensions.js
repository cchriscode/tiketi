const db = require('./src/config/database');

(async () => {
  try {
    const ext = await db.query(`
      SELECT extname, nspname as schema
      FROM pg_extension e
      JOIN pg_namespace n ON e.extnamespace = n.oid
      WHERE extname IN ('uuid-ossp', 'pg_trgm')
    `);

    console.log('\n📦 Installed extensions:');
    if (ext.rows.length === 0) {
      console.log('  (none)');
    } else {
      ext.rows.forEach(r => console.log(`  - ${r.extname} (schema: ${r.schema})`));
    }

    // Check if extensions work
    console.log('\n🧪 Testing uuid_generate_v4()...');
    try {
      const test = await db.query('SELECT uuid_generate_v4()');
      console.log(`  ✅ Works: ${test.rows[0].uuid_generate_v4()}`);
    } catch (err) {
      console.log(`  ❌ Failed: ${err.message}`);
    }

    await db.pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await db.pool.end();
    process.exit(1);
  }
})();
