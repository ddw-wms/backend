// File Path = warehouse-backend/src/routes/inventory.routes.ts
import express from 'express';
import {
    getInventorySummary,
    getAvailableStock,
    getStockByStatus,
    getMovementHistory
}
    from '../controllers/inventory.controller';
import { authMiddleware, } from '../middleware/auth.middleware';

const router = express.Router();

// All inventory routes require authentication
router.use(authMiddleware);

// Get inventory summary for warehouse
router.get('/summary', getInventorySummary);

// Get available stock with pagination
router.get('/available-stock', getAvailableStock);

// Get stock filtered by status
router.get('/by-status', getStockByStatus);

// Get movement history for a WSN
router.get('/movement-history', getMovementHistory);

export default router;
