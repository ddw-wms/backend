-- Add stack_trace column to error_logs
-- Run this in Supabase SQL Editor

ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS stack_trace TEXT;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS method VARCHAR(10);
