/**
 * Database Schema Migration Script
 * Runs all MSA schema migrations in order
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'tiketi',
  user: process.env.DB_USER || 'tiketi_user',
  password: process.env.DB_PASSWORD || 'tiketi_pass',
});

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
    await pool.query(sql);
    log(`      ✅ Success`, 'green');
    return true;
  } catch (error) {
    log(`      ❌ Failed: ${error.message}`, 'red');
    return false;
  }
}

async function checkSchemas() {
  try {
    const result = await pool.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name LIKE '%_schema'
      ORDER BY schema_name
    `);

    log('\n📊 Current schemas:', 'blue');
    result.rows.forEach((row) => {
      log(`  - ${row.schema_name}`, 'yellow');
    });

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
    await pool.query('SELECT NOW()');
    log('  ✅ Connected to PostgreSQL', 'green');
  } catch (error) {
    log(`  ❌ Connection failed: ${error.message}`, 'red');
    process.exit(1);
  }

  // Check current schemas
  await checkSchemas();

  // Project root directory
  const projectRoot = path.resolve(__dirname, '..');
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

  // Summary
  log('\n═══════════════════════════════════════════════════', 'blue');
  log('  Migration Summary', 'blue');
  log('═══════════════════════════════════════════════════', 'blue');
  log(`  ✅ Successful: ${successCount}`, 'green');
  if (failCount > 0) {
    log(`  ❌ Failed: ${failCount}`, 'red');
  }

  log('', 'reset');

  await pool.end();

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  console.error(error);
  pool.end();
  process.exit(1);
});
