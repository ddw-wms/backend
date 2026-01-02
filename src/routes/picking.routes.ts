// File Path = warehouse-backend/src/routes/picking.routes.ts
import { Router } from 'express';
import { authMiddleware, hasRole } from '../middleware/auth.middleware';
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

// GET source data by WSN (QC → INBOUND → MASTER priority) - admin, manager, picker
router.get('/source-by-wsn', hasRole('admin', 'manager', 'picker'), getSourceByWSN);

// POST multi-entry with auto batch ID - only admin and picker
router.post('/multi-entry', hasRole('admin', 'picker'), multiPickingEntry);

// GET picking list with filters & pagination - admin, manager, picker
router.get('/list', hasRole('admin', 'manager', 'picker'), getPickingList);

// GET customers from customers table - admin, manager, picker
router.get('/customers', hasRole('admin', 'manager', 'picker'), getCustomers);

// GET check if WSN exists - admin, manager, picker
router.get('/check-wsn', hasRole('admin', 'manager', 'picker'), checkWSNExists);

// GET all existing WSNs - admin, manager, picker
router.get('/existing-wsns', hasRole('admin', 'manager', 'picker'), getExistingWSNs);

// GET batches - admin, manager, picker
router.get('/batches', hasRole('admin', 'manager', 'picker'), getBatches);

// DELETE batch - only admin
router.delete('/batch/:batchId', hasRole('admin'), deleteBatch);

export default router;