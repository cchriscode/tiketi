#!/bin/bash
# Google OAuth Migration Script
# Run this after PostgreSQL is up and running

echo "🚀 Running Google OAuth migration..."

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ psql not found. Please install PostgreSQL client."
    exit 1
fi

# Run migration
psql -U tiketi_user -d tiketi -h localhost << 'EOF'
-- Add Google OAuth support to users table
-- Migration: add_google_oauth.sql

-- Add google_id column for Google OAuth users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Allow password_hash to be NULL for Google-only users
ALTER TABLE users
ALTER COLUMN password_hash DROP NOT NULL;

COMMENT ON COLUMN users.google_id IS 'Google OAuth user ID (sub claim from Google ID token)';

-- Verify changes
\d users
EOF

if [ $? -eq 0 ]; then
    echo "✅ Google OAuth migration completed successfully!"
else
    echo "❌ Migration failed. Check the error messages above."
    exit 1
fi
