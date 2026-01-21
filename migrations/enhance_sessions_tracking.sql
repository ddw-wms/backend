-- Enhanced Sessions & User Activity Tracking
-- Run this in Supabase SQL Editor

-- ==================== 1. ENHANCE active_sessions TABLE ====================
-- Add new columns for real-time tracking and device info

ALTER TABLE active_sessions 
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS device_type VARCHAR(20) DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS browser VARCHAR(50) DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS os VARCHAR(50) DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS location VARCHAR(100);

-- Index for fast online status lookup
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON active_sessions(last_activity);

-- ==================== 2. CREATE login_history TABLE ====================
CREATE TABLE IF NOT EXISTS login_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    login_time TIMESTAMP NOT NULL DEFAULT NOW(),
    logout_time TIMESTAMP,
    duration_minutes INTEGER,
    ip_address VARCHAR(45),
    device_type VARCHAR(20) DEFAULT 'unknown',
    browser VARCHAR(50) DEFAULT 'unknown',
    os VARCHAR(50) DEFAULT 'unknown',
    location VARCHAR(100),
    logout_reason VARCHAR(20) DEFAULT 'active', -- 'manual', 'expired', 'forced', 'active'
    session_token_hash VARCHAR(64),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_login_time ON login_history(login_time DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_logout_reason ON login_history(logout_reason);

-- ==================== 3. CREATE user_activity_logs TABLE ====================
CREATE TABLE IF NOT EXISTS user_activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- 'page_view', 'action', 'api_call'
    module VARCHAR(50), -- 'inbound', 'outbound', 'qc', 'picking', etc.
    action VARCHAR(100), -- 'create', 'update', 'delete', 'export', 'view'
    details JSONB, -- Additional context like record IDs, counts, etc.
    ip_address VARCHAR(45),
    user_agent TEXT,
    warehouse_id INTEGER,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON user_activity_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON user_activity_logs(module);
CREATE INDEX IF NOT EXISTS idx_activity_logs_warehouse ON user_activity_logs(warehouse_id);

-- ==================== 4. ADD last_seen TO users TABLE ====================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45),
ADD COLUMN IF NOT EXISTS last_login_device VARCHAR(100);

-- ==================== 5. FUNCTION TO UPDATE USER last_seen ====================
CREATE OR REPLACE FUNCTION update_user_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users SET last_seen = NEW.last_activity WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update user last_seen when session activity updates
DROP TRIGGER IF EXISTS trigger_update_last_seen ON active_sessions;
CREATE TRIGGER trigger_update_last_seen
AFTER UPDATE OF last_activity ON active_sessions
FOR EACH ROW
EXECUTE FUNCTION update_user_last_seen();

-- ==================== 6. FUNCTION TO RECORD LOGIN HISTORY ====================
CREATE OR REPLACE FUNCTION record_login_on_session_create()
RETURNS TRIGGER AS $$
BEGIN
    -- Create login history record when new session is created
    INSERT INTO login_history (
        user_id, login_time, ip_address, device_type, browser, os, 
        session_token_hash, logout_reason
    ) VALUES (
        NEW.user_id, NEW.created_at, NEW.ip_address, NEW.device_type, 
        NEW.browser, NEW.os, NEW.token_hash, 'active'
    );
    
    -- Update user's last_login info
    UPDATE users SET 
        last_login = NEW.created_at,
        last_login_ip = NEW.ip_address,
        last_login_device = CONCAT(NEW.device_type, ' - ', NEW.browser, ' on ', NEW.os)
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to record login history when session is created
DROP TRIGGER IF EXISTS trigger_record_login ON active_sessions;
CREATE TRIGGER trigger_record_login
AFTER INSERT ON active_sessions
FOR EACH ROW
EXECUTE FUNCTION record_login_on_session_create();

-- ==================== 7. FUNCTION TO RECORD LOGOUT ====================
CREATE OR REPLACE FUNCTION record_logout_on_session_deactivate()
RETURNS TRIGGER AS $$
BEGIN
    -- Only when session is being deactivated
    IF OLD.is_active = true AND NEW.is_active = false THEN
        UPDATE login_history 
        SET 
            logout_time = NOW(),
            duration_minutes = EXTRACT(EPOCH FROM (NOW() - login_time)) / 60,
            logout_reason = COALESCE(
                (SELECT CASE 
                    WHEN NEW.expires_at < NOW() THEN 'expired'
                    ELSE 'forced'
                END),
                'manual'
            )
        WHERE session_token_hash = OLD.token_hash AND logout_time IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to record logout when session is deactivated
DROP TRIGGER IF EXISTS trigger_record_logout ON active_sessions;
CREATE TRIGGER trigger_record_logout
AFTER UPDATE OF is_active ON active_sessions
FOR EACH ROW
EXECUTE FUNCTION record_logout_on_session_deactivate();

-- ==================== 8. CLEANUP OLD DATA (Optional Scheduled Job) ====================
-- Delete login history older than 90 days
-- DELETE FROM login_history WHERE login_time < NOW() - INTERVAL '90 days';

-- Delete activity logs older than 30 days
-- DELETE FROM user_activity_logs WHERE timestamp < NOW() - INTERVAL '30 days';

-- ==================== 9. UPDATE EXISTING SESSIONS ====================
-- Set default values for existing rows
UPDATE active_sessions 
SET 
    last_activity = COALESCE(last_activity, created_at),
    device_type = COALESCE(device_type, 'unknown'),
    browser = COALESCE(browser, 'unknown'),
    os = COALESCE(os, 'unknown')
WHERE last_activity IS NULL OR device_type IS NULL;

COMMENT ON TABLE login_history IS 'Tracks all user login/logout events with device information';
COMMENT ON TABLE user_activity_logs IS 'Tracks detailed user activities within the application';
COMMENT ON COLUMN active_sessions.last_activity IS 'Updated by heartbeat - used for real-time online status';
