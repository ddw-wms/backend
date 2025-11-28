// import { Router } from 'express';
// import * as dashboardController from '../controllers/dashboard.controller';

// const router = Router();

// // Get inventory pipeline (Inbound + QC + Picking + Outbound joined)
// router.get('/inventory-pipeline', dashboardController.getInventoryPipeline);

// // Get inventory metrics
// router.get('/inventory-metrics', dashboardController.getInventoryMetrics);

// // Get activity logs
// router.get('/activity-logs', dashboardController.getActivityLogs);


// export default router;



import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';

const router = Router();

// Get inventory pipeline (Inbound + QC + Picking + Outbound joined)
router.get('/inventory-pipeline', dashboardController.getInventoryPipeline);

// Get inventory metrics
router.get('/inventory-metrics', dashboardController.getInventoryMetrics);

// Get activity logs
router.get('/activity-logs', dashboardController.getActivityLogs);

// ✅ NEW: Get data for export with complete details from all modules
router.get('/export-data', dashboardController.getInventoryDataForExport);

export default router;