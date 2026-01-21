-- Migration: Fix NULL created_at in inbound table
-- Date: 2026-01-21
-- Purpose: Ensure all inbound records have created_at set for batch date display

-- Update NULL created_at values with the inbound_date (fallback)
UPDATE inbound 
SET created_at = COALESCE(
    inbound_date::timestamp, 
    CURRENT_TIMESTAMP
)
WHERE created_at IS NULL;

-- Ensure created_at has a default value for future inserts
ALTER TABLE inbound 
ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

-- Verify the fix
SELECT 
    batch_id, 
    COUNT(*) as count, 
    MAX(created_at) as last_updated,
    MIN(created_at) as first_entry
FROM inbound 
WHERE batch_id IS NOT NULL 
GROUP BY batch_id 
ORDER BY last_updated DESC 
LIMIT 10;
