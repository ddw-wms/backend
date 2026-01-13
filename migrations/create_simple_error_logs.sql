-- Simple Error Logs Table (Minimal storage)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS error_logs (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    endpoint VARCHAR(255),
    username VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_error_logs_created ON error_logs(created_at DESC);

-- Auto-delete logs older than 7 days (optional - saves space)
-- Run manually or set up a cron job
-- DELETE FROM error_logs WHERE created_at < NOW() - INTERVAL '7 days';
