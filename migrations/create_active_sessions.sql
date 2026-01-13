-- Active Sessions Table for tracking logged-in users
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS active_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,  -- SHA256 hash of JWT token
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- Indexes for faster lookups
CREATE INDEX idx_sessions_user_id ON active_sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON active_sessions(token_hash);
CREATE INDEX idx_sessions_is_active ON active_sessions(is_active);
CREATE INDEX idx_sessions_expires ON active_sessions(expires_at);

-- Auto-cleanup expired sessions (optional cron job)
-- DELETE FROM active_sessions WHERE expires_at < NOW() OR is_active = false;
