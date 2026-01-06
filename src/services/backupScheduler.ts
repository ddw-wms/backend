// File Path = warehouse-backend/src/services/backupScheduler.ts
import cron from 'node-cron';
import { query } from '../config/database';
import { createJSONBackup } from '../utils/supabaseBackup';
import { uploadToR2, isR2Configured } from './cloudflareR2';
import fs from 'fs';
import path from 'path';

const BACKUP_DIR = path.join(__dirname, '../../backups');

interface Schedule {
    id: number;
    name: string;
    frequency: string;
    backup_type: string;
    description: string;
    enabled: boolean;
    time_of_day: string;
    day_of_week: number;
    day_of_month: number;
    retention_days: number;
    next_run_at: string;
}

class BackupScheduler {
    private scheduledJobs: Map<number, cron.ScheduledTask> = new Map();
    private isInitialized = false;

    // Initialize scheduler - load all active schedules
    async initialize() {
        if (this.isInitialized) {
            console.log('⚠️ Backup scheduler already initialized');
            return;
        }

        console.log('🕐 Initializing backup scheduler...');

        try {
            // Load all enabled schedules
            const result = await query(
                'SELECT * FROM backup_schedules WHERE enabled = true'
            );

            for (const schedule of result.rows) {
                this.scheduleBackup(schedule);
            }

            // Start cleanup job (runs daily at 3 AM)
            this.startCleanupJob();

            this.isInitialized = true;
            console.log(`✅ Backup scheduler initialized with ${result.rows.length} active schedule(s)`);
        } catch (error: any) {
            console.error('❌ Failed to initialize backup scheduler:', error.message);
        }
    }

    // Create a cron schedule from schedule config
    private getCronExpression(schedule: Schedule): string {
        const [hour, minute] = schedule.time_of_day.split(':').map(Number);

        switch (schedule.frequency) {
            case 'hourly':
                return `0 * * * *`; // Every hour at minute 0

            case 'daily':
                return `${minute} ${hour} * * *`; // Daily at specified time

            case 'weekly':
                return `${minute} ${hour} * * ${schedule.day_of_week}`; // Weekly on specified day

            case 'monthly':
                return `${minute} ${hour} ${schedule.day_of_month} * *`; // Monthly on specified day

            default:
                return `${minute} ${hour} * * *`; // Default to daily
        }
    }

    // Schedule a backup job
    scheduleBackup(schedule: Schedule) {
        try {
            // Cancel existing job if any
            if (this.scheduledJobs.has(schedule.id)) {
                this.scheduledJobs.get(schedule.id)?.stop();
                this.scheduledJobs.delete(schedule.id);
            }

            const cronExpression = this.getCronExpression(schedule);
            console.log(`📅 Scheduling backup "${schedule.name}" with cron: ${cronExpression}`);

            const job = cron.schedule(cronExpression, async () => {
                await this.executeScheduledBackup(schedule);
            });

            this.scheduledJobs.set(schedule.id, job);

            // Update next run time
            this.updateNextRunTime(schedule.id);

        } catch (error: any) {
            console.error(`❌ Failed to schedule backup ${schedule.id}:`, error.message);
        }
    }

    // Execute a scheduled backup
    private async executeScheduledBackup(schedule: Schedule) {
        console.log(`🔄 Executing scheduled backup: ${schedule.name}`);

        try {
            // Create JSON backup
            const backupResult = await createJSONBackup({
                includeUsers: schedule.backup_type === 'full'
            });

            // Upload to Cloudflare R2 (if configured)
            if (isR2Configured()) {
                await uploadToR2(backupResult.filePath, backupResult.fileName);
            }

            // Save backup metadata to database
            await query(
                `INSERT INTO backups (
                    file_name, 
                    file_path, 
                    file_size, 
                    backup_type, 
                    description, 
                    created_by
                ) VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    backupResult.fileName,
                    backupResult.filePath,
                    backupResult.fileSize,
                    'json',
                    `${schedule.description || 'Scheduled backup'} (${schedule.name})`,
                    null // System-generated
                ]
            );

            // Log success
            await query(
                `INSERT INTO backup_restore_logs (action, status, message)
                 VALUES ($1, $2, $3)`,
                ['backup', 'success', `Scheduled backup completed: ${schedule.name}`]
            );

            // Update last run time
            await query(
                'UPDATE backup_schedules SET last_run_at = NOW() WHERE id = $1',
                [schedule.id]
            );

            // Update next run time
            await this.updateNextRunTime(schedule.id);

            console.log(`✅ Scheduled backup completed: ${schedule.name} (${backupResult.fileSizeMB} MB)`);

            // Run retention cleanup for this schedule
            await this.cleanupOldBackups(schedule.retention_days);

        } catch (error: any) {
            console.error(`❌ Scheduled backup failed: ${schedule.name}`, error.message);

            // Log failure
            await query(
                `INSERT INTO backup_restore_logs (action, status, message)
                 VALUES ($1, $2, $3)`,
                ['backup', 'failed', `Scheduled backup failed: ${schedule.name} - ${error.message}`]
            );
        }
    }

    // Update next run time for a schedule
    private async updateNextRunTime(scheduleId: number) {
        try {
            const result = await query(
                'SELECT * FROM backup_schedules WHERE id = $1',
                [scheduleId]
            );

            if (result.rows.length === 0) return;

            const schedule = result.rows[0];
            const cronExpression = this.getCronExpression(schedule);

            // Calculate next run (simplified - just add interval to current time)
            let nextRun = new Date();

            switch (schedule.frequency) {
                case 'hourly':
                    nextRun.setHours(nextRun.getHours() + 1);
                    break;
                case 'daily':
                    nextRun.setDate(nextRun.getDate() + 1);
                    break;
                case 'weekly':
                    nextRun.setDate(nextRun.getDate() + 7);
                    break;
                case 'monthly':
                    nextRun.setMonth(nextRun.getMonth() + 1);
                    break;
            }

            await query(
                'UPDATE backup_schedules SET next_run_at = $1, updated_at = NOW() WHERE id = $2',
                [nextRun, scheduleId]
            );
        } catch (error) {
            console.error('Failed to update next run time:', error);
        }
    }

    // Cancel a scheduled job
    cancelSchedule(scheduleId: number) {
        if (this.scheduledJobs.has(scheduleId)) {
            this.scheduledJobs.get(scheduleId)?.stop();
            this.scheduledJobs.delete(scheduleId);
            console.log(`🛑 Cancelled schedule: ${scheduleId}`);
        }
    }

    // Reload a specific schedule
    async reloadSchedule(scheduleId: number) {
        try {
            const result = await query(
                'SELECT * FROM backup_schedules WHERE id = $1',
                [scheduleId]
            );

            if (result.rows.length === 0) {
                console.error(`Schedule ${scheduleId} not found`);
                return;
            }

            const schedule = result.rows[0];

            // Cancel existing job
            this.cancelSchedule(scheduleId);

            // Reschedule if enabled
            if (schedule.enabled) {
                this.scheduleBackup(schedule);
            }
        } catch (error: any) {
            console.error(`Failed to reload schedule ${scheduleId}:`, error.message);
        }
    }

    // Reload all schedules
    async reloadAllSchedules() {
        console.log('🔄 Reloading all backup schedules...');

        // Cancel all existing jobs
        this.scheduledJobs.forEach((job, id) => {
            job.stop();
        });
        this.scheduledJobs.clear();

        // Reload from database
        this.isInitialized = false;
        await this.initialize();
    }

    // Cleanup old backups based on retention policy
    private async cleanupOldBackups(retentionDays: number) {
        if (retentionDays <= 0) return; // 0 means never delete

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            // Get old backups
            const result = await query(
                'SELECT id, file_path FROM backups WHERE created_at < $1',
                [cutoffDate]
            );

            console.log(`🗑️ Found ${result.rows.length} old backup(s) to clean up`);

            for (const backup of result.rows) {
                try {
                    // Delete file from disk
                    if (fs.existsSync(backup.file_path)) {
                        fs.unlinkSync(backup.file_path);
                    }

                    // Delete record from database
                    await query('DELETE FROM backups WHERE id = $1', [backup.id]);

                    console.log(`  ✓ Deleted old backup: ${backup.id}`);
                } catch (err) {
                    console.error(`  ✗ Failed to delete backup ${backup.id}:`, err);
                }
            }
        } catch (error: any) {
            console.error('Cleanup failed:', error.message);
        }
    }

    // Start daily cleanup job
    private startCleanupJob() {
        // Run at 3 AM every day
        cron.schedule('0 3 * * *', async () => {
            console.log('🧹 Running daily backup cleanup...');

            try {
                // Get all schedules with retention policies
                const result = await query(
                    'SELECT DISTINCT retention_days FROM backup_schedules WHERE retention_days > 0'
                );

                for (const row of result.rows) {
                    await this.cleanupOldBackups(row.retention_days);
                }

                console.log('✅ Daily cleanup completed');
            } catch (error) {
                console.error('Daily cleanup failed:', error);
            }
        });

        console.log('🧹 Daily cleanup job scheduled (3:00 AM)');
    }

    // Get scheduler status
    getStatus() {
        return {
            initialized: this.isInitialized,
            activeJobs: this.scheduledJobs.size,
            schedules: Array.from(this.scheduledJobs.keys())
        };
    }
}

// Export singleton instance
export const backupScheduler = new BackupScheduler();
