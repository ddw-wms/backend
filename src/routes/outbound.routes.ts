// File Path = warehouse-backend/src/routes/outbound.routes.ts
import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, hasRole, } from '../middleware/auth.middleware';
import {
  requirePermission,
  requireWarehouseAccess,
  injectWarehouseFilter
} from '../middleware/rbac.middleware';
import {
  getAllOutboundWSNs,
  getPendingForOutbound,
  getSourceByWSN,
  createSingleEntry,
  multiEntry,
  bulkUpload,
  getList,
  getCustomers,
  getExistingWSNs,
  getBatches,
  deleteBatch,
  exportToExcel,
  getBrands,
  getCategories,
  getSources
} from '../controllers/outbound.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication
router.use(authMiddleware);

// View routes - require view permission
router.get('/all-wsns', injectWarehouseFilter, requirePermission('feature:outbound:view'), getAllOutboundWSNs);
router.get('/pending', injectWarehouseFilter, requirePermission('feature:outbound:view'), getPendingForOutbound);
router.get('/source-by-wsn', requirePermission('feature:outbound:view'), getSourceByWSN);
router.get('/list', injectWarehouseFilter, requirePermission('feature:outbound:view'), getList);
router.get('/customers', requirePermission('feature:outbound:view'), getCustomers);
router.get('/existing-wsns', injectWarehouseFilter, requirePermission('feature:outbound:view'), getExistingWSNs);
router.get('/batches', injectWarehouseFilter, requirePermission('feature:outbound:view'), getBatches);
router.get('/brands', requirePermission('feature:outbound:view'), getBrands);
router.get('/categories', requirePermission('feature:outbound:view'), getCategories);
router.get('/sources', requirePermission('feature:outbound:view'), getSources);

// Export routes - require export permission
router.get('/export', injectWarehouseFilter, requirePermission('feature:outbound:export'), exportToExcel);

// Create routes - require create permission
router.post('/single', requireWarehouseAccess, requirePermission('feature:outbound:create'), createSingleEntry);
router.post('/multi', requireWarehouseAccess, requirePermission('feature:outbound:create'), multiEntry);
router.post('/bulk', requireWarehouseAccess, requirePermission('feature:outbound:create'), upload.single('file'), bulkUpload);

// Delete routes - require delete permission
router.delete('/batch/:batchId', requirePermission('feature:outbound:delete'), deleteBatch);

export default router;