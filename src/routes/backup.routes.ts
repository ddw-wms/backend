// File Path = warehouse-backend/src/routes/backup.routes.ts
import express, { Router } from 'express';
import { authMiddleware, hasRole } from '../middleware/auth.middleware';
import * as backupController from '../controllers/backup.controller';

const router: Router = express.Router();

// All backup routes require authentication
router.use(authMiddleware);

// Create new backup (admin only)
router.post(
    '/',
    hasRole('admin'),
    backupController.createBackup
);

// Get all backups
router.get(
    '/',
    hasRole('admin'),
    backupController.getAllBackups
);

// Get database statistics
router.get(
    '/stats',
    hasRole('admin'),
    backupController.getDatabaseStats
);

// Get restore logs
router.get(
    '/restore-logs',
    hasRole('admin'),
    backupController.getRestoreLogs
);

// Download backup file
router.get(
    '/download/:id',
    hasRole('admin'),
    backupController.downloadBackup
);

// Restore database from backup (admin only)
router.post(
    '/restore/:id',
    hasRole('admin'),
    backupController.restoreBackup
);

// Delete backup
router.delete(
    '/:id',
    hasRole('admin'),
    backupController.deleteBackup
);

// Export as JSON
router.post(
    '/export-json',
    hasRole('admin'),
    backupController.exportAsJSON
);

export default router;
