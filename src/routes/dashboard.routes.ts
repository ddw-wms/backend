// File Path = warehouse-backend/src/routes/dashboard.routes.ts
import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// All dashboard routes require authentication
router.use(authMiddleware);

// Get inventory pipeline (Inbound + QC + Picking + Outbound joined)
router.get('/inventory-pipeline', dashboardController.getInventoryPipeline);

// Get inventory metrics
router.get('/inventory-metrics', dashboardController.getInventoryMetrics);

// Get activity logs
router.get('/activity-logs', dashboardController.getActivityLogs);

// ✅ NEW: Export data with filters
router.get('/export-data', dashboardController.getInventoryDataForExport);

export default router;