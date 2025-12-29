# Google OAuth Migration Script (PowerShell)
# Run this after PostgreSQL is up and running

Write-Host "🚀 Running Google OAuth migration..." -ForegroundColor Cyan

$env:PGPASSWORD = "tiketi_pass"

# Migration SQL
$sql = @"
-- Add Google OAuth support to users table

-- Add google_id column for Google OAuth users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Allow password_hash to be NULL for Google-only users
ALTER TABLE users
ALTER COLUMN password_hash DROP NOT NULL;

COMMENT ON COLUMN users.google_id IS 'Google OAuth user ID (sub claim from Google ID token)';
"@

# Try to run migration via WSL
try {
    Write-Host "Attempting migration via WSL..." -ForegroundColor Yellow

    $sql | wsl bash -c "psql -U tiketi_user -d tiketi -h localhost"

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Google OAuth migration completed successfully!" -ForegroundColor Green

        # Verify
        Write-Host "`nVerifying changes..." -ForegroundColor Cyan
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'google_id';" | wsl bash -c "psql -U tiketi_user -d tiketi -h localhost"
    } else {
        Write-Host "❌ Migration failed" -ForegroundColor Red
        Write-Host "`nPlease run manually:" -ForegroundColor Yellow
        Write-Host "psql -U tiketi_user -d tiketi -f database/migrations/add_google_oauth.sql" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host "`nPlease run manually:" -ForegroundColor Yellow
    Write-Host "psql -U tiketi_user -d tiketi -f database/migrations/add_google_oauth.sql" -ForegroundColor White
}
