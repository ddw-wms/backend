// File Path = warehouse-backend/src/routes/inventory.routes.ts
import express from 'express';
import {
    getInventorySummary,
    getAvailableStock,
    getStockByStatus,
    getMovementHistory
}
    from '../controllers/inventory.controller';
import { authMiddleware, hasPermission } from '../middleware/auth.middleware';

const router = express.Router();

// All inventory routes require authentication
router.use(authMiddleware);

// Get inventory summary for warehouse
router.get('/summary', hasPermission('view_inventory'), getInventorySummary);

// Get available stock with pagination
router.get('/available-stock', hasPermission('view_inventory'), getAvailableStock);

// Get stock filtered by status
router.get('/by-status', hasPermission('view_inventory'), getStockByStatus);

// Get movement history for a WSN
router.get('/movement-history', hasPermission('view_inventory'), getMovementHistory);

export default router;
