-- Migration: Add is_pinned column to news table for pinned announcements

BEGIN;

-- Add is_pinned column to news table
ALTER TABLE news ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- Create index for faster pinned news queries
CREATE INDEX IF NOT EXISTS idx_news_pinned ON news(is_pinned, created_at DESC);

COMMIT;

-- Verification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'news' AND column_name = 'is_pinned';
