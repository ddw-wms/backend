// File Path = warehouse-backend/src/routes/warehouses.routes.ts
import express, { Router } from 'express';
import { authMiddleware, adminOnly, hasPermission } from '../middleware/auth.middleware';
import * as warehouseController from '../controllers/warehouses.controller';

const router: Router = express.Router();

router.get('/', authMiddleware, warehouseController.getWarehouses);
router.post('/', authMiddleware, hasPermission('create_warehouse'), warehouseController.createWarehouse);
router.put('/:id', authMiddleware, hasPermission('edit_warehouse'), warehouseController.updateWarehouse);
router.delete('/:id', authMiddleware, hasPermission('delete_warehouse'), warehouseController.deleteWarehouse);
router.patch('/:id/set-active', authMiddleware, warehouseController.setActiveWarehouse);

export default router;
