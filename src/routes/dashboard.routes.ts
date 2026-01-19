// File Path = warehouse-backend/src/routes/dashboard.routes.ts
import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { injectWarehouseFilter } from '../middleware/rbac.middleware';

const router = Router();

// All dashboard routes require authentication
router.use(authMiddleware);

// Get inventory pipeline (Inbound + QC + Picking + Outbound joined)
router.get('/inventory-pipeline', injectWarehouseFilter, dashboardController.getInventoryPipeline);

// Get inventory metrics
router.get('/inventory-metrics', injectWarehouseFilter, dashboardController.getInventoryMetrics);

// Get activity logs
router.get('/activity-logs', injectWarehouseFilter, dashboardController.getActivityLogs);

// ✅ NEW: Export data with filters
router.get('/export-data', injectWarehouseFilter, dashboardController.getInventoryDataForExport);

// ✅ PIVOT TABLE APIs - Server-side aggregation for large data
router.get('/pivot-summary', injectWarehouseFilter, dashboardController.getPivotSummary);
router.get('/pivot-filters', injectWarehouseFilter, dashboardController.getPivotFilters);
router.get('/pivot-drilldown', injectWarehouseFilter, dashboardController.getPivotDrilldown);

export default router;