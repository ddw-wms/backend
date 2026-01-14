import { Router } from 'express';

import {
  getPendingInboundForQC,
  getQCList,
  createQCEntry,
  bulkQCUpload,
  multiQCEntry,
  getQCStats,
  getQCBatches,
  deleteQCBatch,
  getQCBrands,
  getQCCategories,
  exportQCData,
  deleteQCEntry,
  getQCTemplate,
  getAllQCWSNs,
} from '../controllers/qc.controller';

import { authMiddleware, hasRole } from '../middleware/auth.middleware';
import {
  requirePermission,
  requireWarehouseAccess,
  injectWarehouseFilter
} from '../middleware/rbac.middleware';
import { upload } from '../middleware/upload.middleware';
import { listTimeout, uploadTimeout } from '../middleware/timeout.middleware';

const router = Router();

// Base authentication for all routes
router.use(authMiddleware);

// View routes - require view permission (extended timeout for large lists)
router.get('/pending-inbound', listTimeout, injectWarehouseFilter, requirePermission('feature:qc:view'), getPendingInboundForQC);
router.get('/wsns/all', listTimeout, injectWarehouseFilter, requirePermission('feature:qc:view'), getAllQCWSNs);
router.get('/list', listTimeout, injectWarehouseFilter, requirePermission('feature:qc:view'), getQCList);
router.get('/stats', injectWarehouseFilter, requirePermission('feature:qc:view'), getQCStats);
router.get('/batches', listTimeout, injectWarehouseFilter, requirePermission('feature:qc:view'), getQCBatches);
router.get('/brands', requirePermission('feature:qc:view'), getQCBrands);
router.get('/categories', requirePermission('feature:qc:view'), getQCCategories);
router.get('/template', requirePermission('feature:qc:view'), getQCTemplate);

// Create routes - require process permission
router.post('/create', requireWarehouseAccess, requirePermission('feature:qc:process'), createQCEntry);
router.post('/multi-entry', requireWarehouseAccess, requirePermission('feature:qc:process'), multiQCEntry);
router.post('/bulk-upload', uploadTimeout, requireWarehouseAccess, requirePermission('feature:qc:process'), upload.single('file'), bulkQCUpload);

// Delete routes - require delete permission
router.delete('/delete/:qcId', requirePermission('feature:qc:delete'), deleteQCEntry);
router.delete('/batch/:batchId', requirePermission('feature:qc:delete'), deleteQCBatch);
router.get('/categories', getQCCategories);

// Export (extended timeout)
router.get('/export', listTimeout, exportQCData);

export default router;