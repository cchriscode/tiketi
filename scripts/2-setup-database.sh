#!/bin/bash
set -e

echo "=========================================="
echo "  TIKETI - Database Setup"
echo "=========================================="
echo ""

# Check if running from project root
if [ ! -f "database/init.sql" ]; then
  echo "??Error: Must run from project root directory"
  echo "   Current directory: $(pwd)"
  exit 1
fi

# Deploy database + cache via Kustomize (dev environment)
echo "Deploying database infrastructure (Kustomize dev overlay)..."

if ! kubectl apply -k k8s/overlays/dev; then
  echo "Failed to apply dev overlay"
  exit 1
fi

echo "Dev environment applied"

# Wait for PostgreSQL to be ready
echo ""
echo "??Waiting for PostgreSQL to be ready (max 120s)..."

if ! kubectl wait --for=condition=ready pod -l app=postgres -n tiketi --timeout=120s; then
  echo "??PostgreSQL pod failed to become ready"
  echo ""
  echo "Pod status:"
  kubectl get pods -n tiketi -l app=postgres
  echo ""
  echo "Pod logs:"
  kubectl logs -n tiketi -l app=postgres --tail=50 || true
  exit 1
fi

# Get pod name
POSTGRES_POD=$(kubectl get pod -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}')

if [ -z "$POSTGRES_POD" ]; then
  echo "??Failed to get PostgreSQL pod name"
  exit 1
fi

echo "??PostgreSQL pod ready: $POSTGRES_POD"

# Wait a bit for PostgreSQL to fully initialize
echo ""
echo "??Waiting for PostgreSQL to fully initialize..."
sleep 5

# Test PostgreSQL connection
echo ""
echo "?�� Testing PostgreSQL connection..."
if ! kubectl exec -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi -c "SELECT 1" > /dev/null 2>&1; then
  echo "??Cannot connect to PostgreSQL"
  exit 1
fi

echo "??PostgreSQL connection successful"

# Initialize base schema and data
echo ""
echo "?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━"
echo "  Step 1/3: Initializing Public Schema"
echo "?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━"
echo ""
echo "Creating base tables and inserting sample data..."
echo "  ??Users table (admin account will be created by backend)"
echo "  ??Seat layouts (3 templates)"
echo "  ??Events (25+ sample events)"
echo "  ??Ticket types"
echo "  ??News articles"
echo ""

if ! cat database/init.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi > /dev/null 2>&1; then
  echo "??Failed to initialize database with init.sql"
  echo ""
  echo "Checking for errors..."
  cat database/init.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi 2>&1 | tail -20
  exit 1
fi

echo "??Public schema initialized successfully"

# Verify data
echo ""
echo "?�� Verifying initial data..."

EVENT_COUNT=$(kubectl exec -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi -t -c "SELECT COUNT(*) FROM events" 2>/dev/null | tr -d ' ')
LAYOUT_COUNT=$(kubectl exec -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi -t -c "SELECT COUNT(*) FROM seat_layouts" 2>/dev/null | tr -d ' ')

if [ "$EVENT_COUNT" -lt 20 ]; then
  echo "??Expected at least 20 events, found: $EVENT_COUNT"
  exit 1
fi

if [ "$LAYOUT_COUNT" -lt 3 ]; then
  echo "??Expected at least 3 seat layouts, found: $LAYOUT_COUNT"
  exit 1
fi

echo "??Data verification passed:"
echo "  ??Events: $EVENT_COUNT"
echo "  ??Seat layouts: $LAYOUT_COUNT"

# Run MSA schema migrations
echo ""
echo "?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━"
echo "  Step 2/3: MSA Schema Migrations"
echo "?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━"
echo ""
echo "Migrating data from public schema to MSA schemas..."
echo ""

echo "  [1/4] Auth Service schema (users table)..."
if ! cat database/migrations/auth-service-schema.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi > /dev/null 2>&1; then
  echo "??Failed to create auth-service schema"
  exit 1
fi
echo "  ??Auth schema created"

echo "  [2/4] Ticket Service schema (events, seats, reservations, news)..."
if ! cat database/migrations/ticket-service-schema.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi > /dev/null 2>&1; then
  echo "??Failed to create ticket-service schema"
  exit 1
fi
echo "  ??Ticket schema created"

echo "  [3/4] Stats Service schema (statistics tables)..."
if ! cat database/migrations/stats-service-schema.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi > /dev/null 2>&1; then
  echo "??Failed to create stats-service schema"
  exit 1
fi
echo "  ??Stats schema created"

echo "  [4/4] Payment Service schema (payments, logs)..."
if ! cat database/migrations/payment-service-schema.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi > /dev/null 2>&1; then
  echo "??Failed to create payment-service schema"
  exit 1
fi
echo "  ??Payment schema created"

# Set search path
echo ""
echo "?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━"
echo "  Step 3/5: Configuring Search Path"
echo "?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━"
echo ""
echo "Setting search_path to prioritize MSA schemas..."

if ! cat database/set_search_path.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi > /dev/null 2>&1; then
  echo "??Failed to set search_path"
  exit 1
fi

echo "??Search path configured"

# Google OAuth Migration
echo ""
echo "?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━"
echo "  Step 4/5: Google OAuth Setup"
echo "?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━"
echo ""
echo "Adding Google OAuth support to users table..."

if ! cat database/migrations/add_google_oauth.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi > /dev/null 2>&1; then
  echo "??Failed to add Google OAuth migration"
  exit 1
fi

echo "??Google OAuth migration completed"

# Clean up public schema tables
echo ""
echo "?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━"
echo "  Step 5/5: Cleanup Public Schema"
echo "?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━"
echo ""
echo "Removing old tables from public schema..."
echo "  (Data has been migrated to MSA schemas)"
echo ""

if ! cat database/cleanup-public-schema.sql | kubectl exec -i -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi > /dev/null 2>&1; then
  echo "??Failed to cleanup public schema"
  echo "   This is not critical - continuing..."
else
  echo "??Public schema cleanup completed"
fi

# Verify MSA schemas
echo ""
echo "?�� Verifying MSA schema migration..."

MSA_EVENT_COUNT=$(kubectl exec -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi -t -c "SELECT COUNT(*) FROM ticket_schema.events" 2>/dev/null | tr -d ' ')

if [ "$MSA_EVENT_COUNT" -lt 20 ]; then
  echo "??Migration verification failed: Expected at least 20 events in ticket_schema, found: $MSA_EVENT_COUNT"
  exit 1
fi

echo "??MSA schema verification passed:"
echo "  ??ticket_schema.events: $MSA_EVENT_COUNT"

# List all schemas
echo ""
echo "?�� Database schemas:"
kubectl exec -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi -c "\dn" | grep -E "Name|schema"

# Create admin account
echo ""
echo "?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━"
echo "  Step 6/6: Creating Admin Account"
echo "?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━"
echo ""
echo "Creating admin account (admin@tiketi.gg)..."

kubectl exec -n tiketi $POSTGRES_POD -- psql -U tiketi_user -d tiketi <<EOF > /dev/null 2>&1
INSERT INTO auth_schema.users (email, password_hash, name, phone, role)
VALUES (
  'admin@tiketi.gg',
  '\$2b\$10\$N9qo8uLOickgx2ZMRZoMye7K7GcmP7aWvPvPzOqWJ0rqvhJz.zzFe',
  'Admin',
  '010-0000-0000',
  'admin'
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = 'admin';
EOF

if [ $? -eq 0 ]; then
  echo "??Admin account created successfully"
  echo "  ??Email: admin@tiketi.gg"
  echo "  ??Password: admin123"
else
  echo "?�️  Admin account creation failed (may already exist)"
fi

echo ""
echo "=========================================="
echo "  ??Database Setup Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ??Public schema: Cleaned up (legacy tables removed)"
echo "  ??MSA schemas: auth, ticket, stats, payment"
echo "  ??Events: $MSA_EVENT_COUNT in ticket_schema"
echo "  ??Seat layouts: $LAYOUT_COUNT templates"
echo "  ??Search path: Configured for MSA"
echo "  ??Google OAuth: Enabled (google_id column added)"
echo "  ??Admin account: admin@tiketi.gg / admin123"
echo ""
echo "Next step: ./scripts/3-build-and-deploy.sh"
echo ""
