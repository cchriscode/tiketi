/**
 * Database Schema Migration Script - Simple Version
 * Just execute each SQL file as-is
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./src/config/database');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runMigration(filePath, description) {
  log(`\n  ➡️  ${description}`, 'blue');
  log(`      File: ${path.basename(filePath)}`, 'yellow');

  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    await db.query(sql);
    log(`      ✅ Success`, 'green');
    return true;
  } catch (error) {
    log(`      ❌ Failed: ${error.message}`, 'red');
    if (error.message.includes('already exists')) {
      log(`      ℹ️  Already exists (skipping)`, 'yellow');
      return true;
    }
    return false;
  }
}

async function main() {
  log('═══════════════════════════════════════════════════', 'blue');
  log('  Database Schema Migration', 'blue');
  log('═══════════════════════════════════════════════════', 'blue');

  // Test connection
  log('\n🔌 Testing database connection...', 'blue');
  try {
    const result = await db.query('SELECT NOW()');
    log(`  ✅ Connected to PostgreSQL: ${result.rows[0].now}`, 'green');
  } catch (error) {
    log(`  ❌ Connection failed: ${error.message}`, 'red');
    process.exit(1);
  }

  // Project root
  const projectRoot = path.resolve(__dirname, '../..');
  const migrationsDir = path.join(projectRoot, 'database', 'migrations');

  // Migration files
  const migrations = [
    {
      file: path.join(migrationsDir, 'auth-service-schema.sql'),
      description: 'Auth Service Schema (auth_schema)',
    },
    {
      file: path.join(migrationsDir, 'ticket-service-schema.sql'),
      description: 'Ticket Service Schema (ticket_schema)',
    },
    {
      file: path.join(migrationsDir, 'payment-service-schema.sql'),
      description: 'Payment Service Schema (payment_schema)',
    },
  ];

  log('\n🔄 Running migrations...', 'blue');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < migrations.length; i++) {
    const migration = migrations[i];
    log(`\n${i + 1}️⃣  ${migration.description}`, 'blue');

    if (!fs.existsSync(migration.file)) {
      log(`      ⚠️  File not found: ${migration.file}`, 'yellow');
      failCount++;
      continue;
    }

    const success = await runMigration(migration.file, migration.description);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  // Check final state
  log('\n═══════════════════════════════════════════════════', 'blue');
  log('\n📊 Final schemas:', 'blue');

  const schemas = await db.query(`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name LIKE '%_schema'
    ORDER BY schema_name
  `);

  schemas.rows.forEach((row) => log(`  - ${row.schema_name}`, 'yellow'));

  log('\n📋 Tables per schema:', 'blue');

  for (const schemaRow of schemas.rows) {
    const schema = schemaRow.schema_name;
    const tables = await db.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = $1
      ORDER BY tablename
    `, [schema]);

    log(`\n  ${schema}:`, 'yellow');
    if (tables.rows.length === 0) {
      log(`    (no tables)`, 'reset');
    } else {
      tables.rows.forEach((row) => log(`    - ${row.tablename}`, 'reset'));
    }
  }

  // Summary
  log('\n═══════════════════════════════════════════════════', 'blue');
  log('  Migration Summary', 'blue');
  log('═══════════════════════════════════════════════════', 'blue');
  log(`  ✅ Successful: ${successCount}`, 'green');
  if (failCount > 0) {
    log(`  ❌ Failed: ${failCount}`, 'red');
  }

  log('\n✅ Migration complete!', 'green');

  await db.pool.end();

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((error) => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  console.error(error);
  db.pool.end();
  process.exit(1);
});
