// File Path = warehouse-backend/src/routes/backup.routes.ts
import express, { Router } from 'express';
import { authMiddleware, hasRole } from '../middleware/auth.middleware';
import { backupTimeout } from '../middleware/timeout.middleware';
import * as backupController from '../controllers/backup.controller';

const router: Router = express.Router();

// All backup routes require authentication
router.use(authMiddleware);

// Create new backup (async mode - no timeout needed)
router.post(
    '/',
    backupController.createBackup
);

// Check backup progress (for async backups)
router.get(
    '/progress/:backupId',
    backupController.getBackupProgress
);

// Get all backups
router.get(
    '/',
    backupController.getAllBackups
);

// Get database statistics
router.get(
    '/stats',
    backupController.getDatabaseStats
);

// Get restore logs
router.get(
    '/restore-logs',
    backupController.getRestoreLogs
);

// Download backup file
router.get(
    '/download/:id',
    backupController.downloadBackup
);

// Restore database from backup (admin/super_admin only) - extended timeout
router.post(
    '/restore/:id',
    backupTimeout,
    hasRole('admin', 'super_admin'),
    backupController.restoreBackup
);

// Delete backup (admin/super_admin only)
router.delete(
    '/:id',
    hasRole('admin', 'super_admin'),
    backupController.deleteBackup
);

// Bulk delete backups (admin/super_admin only)
router.post(
    '/bulk-delete',
    hasRole('admin', 'super_admin'),
    backupController.bulkDeleteBackups
);

// Selective backup (specific tables)
router.post(
    '/selective',
    backupController.createSelectiveBackup
);

// Export as JSON (extended timeout)
router.post(
    '/export-json',
    backupTimeout,
    backupController.exportAsJSON
);

// ========== NEW SCHEDULED BACKUP ROUTES ==========

// Get backup health statistics
router.get(
    '/health/stats',
    backupController.getHealthStats
);

// Get scheduler status
router.get(
    '/scheduler/status',
    backupController.getSchedulerStatus
);

// Get all schedules
router.get(
    '/schedules',
    backupController.getAllSchedules
);

// Create new schedule
router.post(
    '/schedules',
    backupController.createSchedule
);

// Update schedule
router.put(
    '/schedules/:id',
    backupController.updateSchedule
);

// Delete schedule
router.delete(
    '/schedules/:id',
    backupController.deleteSchedule
);

// Toggle schedule enabled/disabled
router.patch(
    '/schedules/:id/toggle',
    backupController.toggleSchedule
);

// Manually trigger a scheduled backup
router.post(
    '/schedules/:id/trigger',
    backupController.triggerScheduledBackup
);

export default router;
