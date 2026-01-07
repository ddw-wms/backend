// File Path = warehouse-backend/src/routes/reports.routes.ts
import express, { Router } from 'express';
import { authMiddleware, hasRole, hasPermission } from '../middleware/auth.middleware';
import * as reportsController from '../controllers/reports.controller';

const router: Router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Inventory Reports
router.get('/current-stock',
    hasPermission('view_reports'),
    reportsController.getCurrentStockReport
);

router.get('/stock-movement',
    hasPermission('view_reports'),
    reportsController.getStockMovementReport
);

// Module-wise Reports
router.get('/inbound',
    hasPermission('view_reports'),
    reportsController.getInboundReport
);

router.get('/outbound',
    hasPermission('view_reports'),
    reportsController.getOutboundReport
);

router.get('/qc',
    hasPermission('view_reports'),
    reportsController.getQCReport
);

router.get('/picking',
    hasPermission('view_reports'),
    reportsController.getPickingReport
);

// Performance Reports
router.get('/user-performance',
    hasPermission('view_reports'),
    reportsController.getUserPerformanceReport
);

router.get('/warehouse-summary',
    hasPermission('view_reports'),
    reportsController.getWarehouseSummary
);

// Export Reports
router.get('/export',
    hasPermission('export_reports'),
    reportsController.exportReportToExcel
);

// Analytics Endpoints
router.get('/trend-analysis',
    hasPermission('view_reports'),
    reportsController.getTrendAnalysis
);

router.get('/qc-analysis',
    hasPermission('view_reports'),
    reportsController.getQCAnalysis
);

router.get('/performance-metrics',
    hasPermission('view_reports'),
    reportsController.getPerformanceMetrics
);

router.get('/exception-reports',
    hasPermission('view_reports'),
    reportsController.getExceptionReports
);

export default router;
