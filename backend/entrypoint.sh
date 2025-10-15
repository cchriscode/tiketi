#!/bin/sh

echo "🔄 Waiting for PostgreSQL to be ready..."

# Wait for PostgreSQL to be ready
until PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; do
  echo "⏳ PostgreSQL is unavailable - waiting..."
  sleep 2
done

echo "✅ PostgreSQL is ready!"
echo "🚀 Starting application..."

# Start the application
npm run dev

