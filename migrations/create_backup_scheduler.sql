-- Migration: Backup Scheduler and Health Tracking
-- Created: 2026-01-06

-- Table for scheduled backup configurations
CREATE TABLE IF NOT EXISTS backup_schedules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('hourly', 'daily', 'weekly', 'monthly')),
    backup_type VARCHAR(20) NOT NULL DEFAULT 'full',
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    time_of_day TIME DEFAULT '02:00:00', -- When to run (for daily/weekly/monthly)
    day_of_week INT DEFAULT 0, -- 0-6 for Sunday-Saturday (for weekly)
    day_of_month INT DEFAULT 1, -- 1-31 (for monthly)
    retention_days INT DEFAULT 30, -- Auto-delete backups older than this
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table for backup health statistics
CREATE TABLE IF NOT EXISTS backup_health_stats (
    id SERIAL PRIMARY KEY,
    total_backups INT DEFAULT 0,
    successful_backups INT DEFAULT 0,
    failed_backups INT DEFAULT 0,
    last_backup_at TIMESTAMP,
    last_backup_status VARCHAR(20),
    last_backup_size BIGINT,
    total_storage_used BIGINT DEFAULT 0,
    average_backup_size BIGINT DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Initialize health stats with single row (safe insert)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM backup_health_stats WHERE id = 1) THEN
        INSERT INTO backup_health_stats (id, updated_at) VALUES (1, NOW());
    END IF;
END $$;

-- Function to update health stats
CREATE OR REPLACE FUNCTION update_backup_health_stats()
RETURNS void AS $$
BEGIN
    UPDATE backup_health_stats SET
        total_backups = (SELECT COUNT(*) FROM backups),
        successful_backups = (SELECT COUNT(*) FROM backup_restore_logs WHERE status = 'success' AND action = 'backup'),
        failed_backups = (SELECT COUNT(*) FROM backup_restore_logs WHERE status = 'failed' AND action = 'backup'),
        last_backup_at = (SELECT MAX(created_at) FROM backups),
        last_backup_size = (SELECT file_size FROM backups ORDER BY created_at DESC LIMIT 1),
        total_storage_used = (SELECT COALESCE(SUM(file_size), 0) FROM backups),
        average_backup_size = (SELECT COALESCE(AVG(file_size), 0) FROM backups),
        success_rate = CASE 
            WHEN (SELECT COUNT(*) FROM backup_restore_logs WHERE action = 'backup') > 0 
            THEN ((SELECT COUNT(*) FROM backup_restore_logs WHERE status = 'success' AND action = 'backup')::DECIMAL / 
                  (SELECT COUNT(*) FROM backup_restore_logs WHERE action = 'backup')::DECIMAL * 100)
            ELSE 0 
        END,
        updated_at = NOW()
    WHERE id = 1;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update health stats after backup creation
CREATE OR REPLACE FUNCTION trigger_update_health_stats()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_backup_health_stats();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'after_backup_insert') THEN
        CREATE TRIGGER after_backup_insert
            AFTER INSERT ON backups
            FOR EACH ROW
            EXECUTE FUNCTION trigger_update_health_stats();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'after_backup_delete') THEN
        CREATE TRIGGER after_backup_delete
            AFTER DELETE ON backups
            FOR EACH ROW
            EXECUTE FUNCTION trigger_update_health_stats();
    END IF;
END $$;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_backup_schedules_enabled ON backup_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_next_run ON backup_schedules(next_run_at) WHERE enabled = true;

-- Comments
COMMENT ON TABLE backup_schedules IS 'Automated backup scheduling configuration';
COMMENT ON TABLE backup_health_stats IS 'Overall backup system health metrics';
COMMENT ON COLUMN backup_schedules.retention_days IS 'Auto-delete backups older than this many days (0 = never delete)';
