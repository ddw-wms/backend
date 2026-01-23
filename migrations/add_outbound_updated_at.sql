-- Migration: Add updated_at column to outbound table
-- Issue: Trigger "update_outbound_updated_at" was failing because the column didn't exist
-- Date: 2026-01-23

-- Add updated_at column if it doesn't exist
ALTER TABLE outbound ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing rows with current timestamp if null
UPDATE outbound SET updated_at = NOW() WHERE updated_at IS NULL;

-- The trigger update_outbound_updated_at already exists and calls update_updated_at_column()
-- This trigger will now work correctly with the new column
