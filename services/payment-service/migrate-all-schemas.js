/**
 * Database Schema Migration Script
 * Runs all MSA schema migrations in order
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
    let sql = fs.readFileSync(filePath, 'utf8');

    // ALWAYS ensure extensions are enabled FIRST in separate queries
    await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await db.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');

    // Split SQL by semicolons and execute statements sequentially
    // This ensures CREATE EXTENSION is applied before tables are created
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      // Skip verification queries at the end
      if (statement.toUpperCase().includes('SELECT') &&
          (statement.includes('table_name') || statement.includes('row_count') ||
           statement.includes('schemaname') || statement.includes('indexname'))) {
        continue;
      }
      await db.query(statement);
    }

    log(`      ✅ Success`, 'green');
    return true;
  } catch (error) {
    log(`      ❌ Failed: ${error.message}`, 'red');
    if (error.message.includes('already exists')) {
      log(`      ℹ️  Schema/table already exists (skipping)`, 'yellow');
      return true;
    }
    return false;
  }
}

async function checkSchemas() {
  try {
    const result = await db.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name LIKE '%_schema'
      ORDER BY schema_name
    `);

    log('\n📊 Current schemas:', 'blue');
    if (result.rows.length === 0) {
      log('  (none)', 'yellow');
    } else {
      result.rows.forEach((row) => {
        log(`  - ${row.schema_name}`, 'yellow');
      });
    }

    return result.rows;
  } catch (error) {
    log(`❌ Failed to check schemas: ${error.message}`, 'red');
    return [];
  }
}

async function main() {
  log('═══════════════════════════════════════════════════', 'blue');
  log('  Database Schema Migration', 'blue');
  log('  MSA Service Schemas', 'blue');
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

  // Check current schemas
  await checkSchemas();

  // Enable UUID extension first
  log('\n🔧 Enabling PostgreSQL extensions...', 'blue');
  try {
    await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    log('  ✅ uuid-ossp extension enabled', 'green');
  } catch (error) {
    log(`  ⚠️  Failed to enable uuid-ossp: ${error.message}`, 'yellow');
  }

  // Project root directory
  const projectRoot = path.resolve(__dirname, '../..');
  const migrationsDir = path.join(projectRoot, 'database', 'migrations');

  // Migration files in order
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

  // Check schemas after migration
  log('\n═══════════════════════════════════════════════════', 'blue');
  await checkSchemas();

  // Verify tables
  log('\n📋 Checking tables in each schema...', 'blue');

  try {
    const authTables = await db.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'auth_schema'
    `);
    log('\n  auth_schema:', 'yellow');
    authTables.rows.forEach((row) => log(`    - ${row.tablename}`, 'reset'));

    const ticketTables = await db.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'ticket_schema'
    `);
    log('\n  ticket_schema:', 'yellow');
    ticketTables.rows.forEach((row) => log(`    - ${row.tablename}`, 'reset'));

    const paymentTables = await db.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'payment_schema'
    `);
    log('\n  payment_schema:', 'yellow');
    paymentTables.rows.forEach((row) => log(`    - ${row.tablename}`, 'reset'));
  } catch (error) {
    log(`\n  ⚠️  Could not verify tables: ${error.message}`, 'yellow');
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
  log('', 'reset');

  await db.pool.end();

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  console.error(error);
  db.pool.end();
  process.exit(1);
});
