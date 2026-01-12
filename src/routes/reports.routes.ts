// File Path = warehouse-backend/src/routes/reports.routes.ts
import express, { Router } from 'express';
import { authMiddleware, hasRole } from '../middleware/auth.middleware';
import * as reportsController from '../controllers/reports.controller';

const router: Router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Inventory Reports
router.get('/current-stock',
    reportsController.getCurrentStockReport
);

router.get('/stock-movement',
    reportsController.getStockMovementReport
);

// Module-wise Reports
router.get('/inbound',
    reportsController.getInboundReport
);

router.get('/outbound',
    reportsController.getOutboundReport
);

router.get('/qc',
    reportsController.getQCReport
);

router.get('/picking',
    reportsController.getPickingReport
);

// Performance Reports
router.get('/user-performance',
    reportsController.getUserPerformanceReport
);

router.get('/warehouse-summary',
    reportsController.getWarehouseSummary
);

// Export Reports
router.get('/export',
    reportsController.exportReportToExcel
);

// Analytics Endpoints
router.get('/trend-analysis',
    reportsController.getTrendAnalysis
);

router.get('/qc-analysis',
    reportsController.getQCAnalysis
);

router.get('/performance-metrics',
    reportsController.getPerformanceMetrics
);

router.get('/exception-reports',
    reportsController.getExceptionReports
);

export default router;
