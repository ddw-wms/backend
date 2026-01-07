// File Path = warehouse-backend/src/routes/picking.routes.ts
import { Router } from 'express';
import { authMiddleware, hasRole, hasPermission } from '../middleware/auth.middleware';
import {
  getSourceByWSN,
  multiPickingEntry,
  getPickingList,
  getCustomers,
  checkWSNExists,
  getExistingWSNs,
  getBatches,
  deleteBatch
} from '../controllers/picking.controller';

const router = Router();

// All picking routes require authentication
router.use(authMiddleware);

// GET source data by WSN (QC → INBOUND → MASTER priority)
router.get('/source-by-wsn', hasPermission('view_picking'), getSourceByWSN);

// POST multi-entry with auto batch ID
router.post('/multi-entry', hasPermission('create_picking_multi'), multiPickingEntry);

// GET picking list with filters & pagination
router.get('/list', hasPermission('view_picking'), getPickingList);

// GET customers from customers table
router.get('/customers', hasPermission('view_picking'), getCustomers);

// GET check if WSN exists
router.get('/check-wsn', hasPermission('view_picking'), checkWSNExists);

// GET all existing WSNs
router.get('/existing-wsns', hasPermission('view_picking'), getExistingWSNs);

// GET batches
router.get('/batches', hasPermission('view_picking'), getBatches);

// DELETE batch
router.delete('/batch/:batchId', hasPermission('delete_picking'), deleteBatch);

export default router;