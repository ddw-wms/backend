// File Path = warehouse-backend/src/routes/picking.routes.ts
import { Router } from 'express';
import { authMiddleware, hasRole, } from '../middleware/auth.middleware';
import {
  requirePermission,
  requireWarehouseAccess,
  injectWarehouseFilter
} from '../middleware/rbac.middleware';
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

// View routes - require view permission
router.get('/source-by-wsn', requirePermission('feature:picking:view'), getSourceByWSN);
router.get('/list', injectWarehouseFilter, requirePermission('feature:picking:view'), getPickingList);
router.get('/customers', requirePermission('feature:picking:view'), getCustomers);
router.get('/check-wsn', requirePermission('feature:picking:view'), checkWSNExists);
router.get('/existing-wsns', injectWarehouseFilter, requirePermission('feature:picking:view'), getExistingWSNs);
router.get('/batches', injectWarehouseFilter, requirePermission('feature:picking:view'), getBatches);

// Create routes - require create permission
router.post('/multi-entry', requireWarehouseAccess, requirePermission('feature:picking:create'), multiPickingEntry);

// Delete routes - require delete permission
router.delete('/batch/:batchId', requirePermission('feature:picking:delete'), deleteBatch);

export default router;