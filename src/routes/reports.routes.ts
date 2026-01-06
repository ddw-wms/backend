// File Path = warehouse-backend/src/routes/reports.routes.ts
import express, { Router } from 'express';
import { authMiddleware, hasRole } from '../middleware/auth.middleware';
import * as reportsController from '../controllers/reports.controller';

const router: Router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Inventory Reports
router.get('/current-stock',
    hasRole('admin', 'manager', 'operator'),
    reportsController.getCurrentStockReport
);

router.get('/stock-movement',
    hasRole('admin', 'manager'),
    reportsController.getStockMovementReport
);

// Module-wise Reports
router.get('/inbound',
    hasRole('admin', 'manager', 'operator'),
    reportsController.getInboundReport
);

router.get('/outbound',
    hasRole('admin', 'manager', 'operator'),
    reportsController.getOutboundReport
);

router.get('/qc',
    hasRole('admin', 'manager', 'qc'),
    reportsController.getQCReport
);

router.get('/picking',
    hasRole('admin', 'manager', 'picker'),
    reportsController.getPickingReport
);

// Performance Reports
router.get('/user-performance',
    hasRole('admin', 'manager'),
    reportsController.getUserPerformanceReport
);

router.get('/warehouse-summary',
    hasRole('admin', 'manager'),
    reportsController.getWarehouseSummary
);

// Export Reports
router.get('/export',
    hasRole('admin', 'manager'),
    reportsController.exportReportToExcel
);

// Analytics Endpoints
router.get('/trend-analysis',
    hasRole('admin', 'manager'),
    reportsController.getTrendAnalysis
);

router.get('/qc-analysis',
    hasRole('admin', 'manager', 'qc'),
    reportsController.getQCAnalysis
);

router.get('/performance-metrics',
    hasRole('admin', 'manager'),
    reportsController.getPerformanceMetrics
);

router.get('/exception-reports',
    hasRole('admin', 'manager'),
    reportsController.getExceptionReports
);

export default router;
