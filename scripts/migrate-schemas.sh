#!/bin/bash

set -e

echo "🔄 Running database schema migrations..."

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Find Postgres pod
POSTGRES_POD=$(kubectl get pods -n tiketi -l app=postgres -o jsonpath='{.items[0].metadata.name}')

if [ -z "$POSTGRES_POD" ]; then
    echo "❌ PostgreSQL pod not found"
    exit 1
fi

echo "📦 Found Postgres pod: $POSTGRES_POD"

# Function to run SQL file
run_migration() {
    local sql_file=$1
    local description=$2

    echo ""
    echo "  ➡️  $description"
    echo "      File: $(basename $sql_file)"

    cat "$sql_file" | kubectl exec -i -n tiketi "$POSTGRES_POD" -- psql -U tiketi_user -d tiketi

    if [ $? -eq 0 ]; then
        echo "      ✅ Success"
    else
        echo "      ❌ Failed"
        exit 1
    fi
}

# Run migrations in order
echo ""
echo "1️⃣  Auth Service Schema"
run_migration "$PROJECT_ROOT/database/migrations/auth-service-schema.sql" "Creating auth_schema"

echo ""
echo "2️⃣  Ticket Service Schema"
run_migration "$PROJECT_ROOT/database/migrations/ticket-service-schema.sql" "Creating ticket_schema"

echo ""
echo "3️⃣  Payment Service Schema"
run_migration "$PROJECT_ROOT/database/migrations/payment-service-schema.sql" "Creating payment_schema"

echo ""
echo "✅ All schemas migrated successfully!"

echo ""
echo "📊 Checking schemas..."
kubectl exec -n tiketi "$POSTGRES_POD" -- psql -U tiketi_user -d tiketi -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE '%_schema';"

echo ""
echo "✅ Migration complete!"
