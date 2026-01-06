-- Database Backup System Tables
-- Run this SQL in your Supabase SQL Editor

-- Create backups table
CREATE TABLE IF NOT EXISTS backups (
    id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    backup_type VARCHAR(50) NOT NULL, -- 'full', 'schema', 'data'
    description TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create backup restore logs table
CREATE TABLE IF NOT EXISTS backup_restore_logs (
    id SERIAL PRIMARY KEY,
    backup_id INTEGER REFERENCES backups(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'restore', 'download'
    status VARCHAR(50) NOT NULL, -- 'success', 'failed'
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backups_backup_type ON backups(backup_type);
CREATE INDEX IF NOT EXISTS idx_backup_restore_logs_backup_id ON backup_restore_logs(backup_id);
CREATE INDEX IF NOT EXISTS idx_backup_restore_logs_created_at ON backup_restore_logs(created_at DESC);

-- Add comments
COMMENT ON TABLE backups IS 'Stores database backup metadata';
COMMENT ON TABLE backup_restore_logs IS 'Logs all backup restore operations';

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL ON backups TO authenticated;
-- GRANT ALL ON backup_restore_logs TO authenticated;
-- GRANT USAGE, SELECT ON SEQUENCE backups_id_seq TO authenticated;
-- GRANT USAGE, SELECT ON SEQUENCE backup_restore_logs_id_seq TO authenticated;

SELECT 'Backup tables created successfully' as status;
