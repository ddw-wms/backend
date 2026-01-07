// File Path = warehouse-backend/src/routes/backup.routes.ts
import express, { Router } from 'express';
import { authMiddleware, hasRole, hasPermission } from '../middleware/auth.middleware';
import * as backupController from '../controllers/backup.controller';

const router: Router = express.Router();

// All backup routes require authentication
router.use(authMiddleware);

// Create new backup
router.post(
    '/',
    hasPermission('create_backup'),
    backupController.createBackup
);

// Get all backups
router.get(
    '/',
    hasPermission('view_backups'),
    backupController.getAllBackups
);

// Get database statistics
router.get(
    '/stats',
    hasPermission('view_backups'),
    backupController.getDatabaseStats
);

// Get restore logs
router.get(
    '/restore-logs',
    hasPermission('view_backups'),
    backupController.getRestoreLogs
);

// Download backup file
router.get(
    '/download/:id',
    hasPermission('view_backups'),
    backupController.downloadBackup
);

// Restore database from backup
router.post(
    '/restore/:id',
    hasPermission('restore_backup'),
    backupController.restoreBackup
);

// Delete backup
router.delete(
    '/:id',
    hasPermission('delete_backup'),
    backupController.deleteBackup
);

// Export as JSON
router.post(
    '/export-json',
    hasPermission('create_backup'),
    backupController.exportAsJSON
);

// ========== NEW SCHEDULED BACKUP ROUTES ==========

// Get backup health statistics
router.get(
    '/health/stats',
    hasPermission('view_backups'),
    backupController.getHealthStats
);

// Get scheduler status
router.get(
    '/scheduler/status',
    hasPermission('view_backups'),
    backupController.getSchedulerStatus
);

// Get all schedules
router.get(
    '/schedules',
    hasPermission('view_backups'),
    backupController.getAllSchedules
);

// Create new schedule
router.post(
    '/schedules',
    hasPermission('configure_backup'),
    backupController.createSchedule
);

// Update schedule
router.put(
    '/schedules/:id',
    hasPermission('configure_backup'),
    backupController.updateSchedule
);

// Delete schedule
router.delete(
    '/schedules/:id',
    hasPermission('delete_backup'),
    backupController.deleteSchedule
);

// Toggle schedule enabled/disabled
router.patch(
    '/schedules/:id/toggle',
    hasPermission('configure_backup'),
    backupController.toggleSchedule
);

// Manually trigger a scheduled backup
router.post(
    '/schedules/:id/trigger',
    hasPermission('create_backup'),
    backupController.triggerScheduledBackup
);

export default router;
