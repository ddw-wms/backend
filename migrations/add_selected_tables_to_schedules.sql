-- Migration: Add selected_tables column to backup_schedules
-- Created: 2026-01-22
-- Purpose: Support selective backup in scheduled backups

-- Add selected_tables column to store module selection for selective backups
ALTER TABLE backup_schedules 
ADD COLUMN IF NOT EXISTS selected_tables TEXT[];

-- Comment explaining the column
COMMENT ON COLUMN backup_schedules.selected_tables IS 
'Array of module IDs for selective backup type (e.g., master_data, inbound, qc, etc.)';

-- Update existing rows with null (full backup)
UPDATE backup_schedules 
SET selected_tables = NULL 
WHERE backup_type != 'selective' AND selected_tables IS NULL;
