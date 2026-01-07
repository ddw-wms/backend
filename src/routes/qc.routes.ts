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

import { authMiddleware, hasRole, hasPermission } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';

const router = Router();

// Base authentication for all routes
router.use(authMiddleware);

// Pending items - permission-based access
router.get('/pending-inbound', hasPermission('view_qc'), getPendingInboundForQC);

// Get all QC'd WSNs (for duplicate checking)
router.get('/wsns/all', hasPermission('view_qc'), getAllQCWSNs);

// QC List & Operations
router.get('/list', hasPermission('view_qc'), getQCList);
router.post('/create', hasPermission('create_qc_single'), createQCEntry);
router.delete('/delete/:qcId', hasPermission('delete_qc'), deleteQCEntry);

// Bulk & Multi
router.post('/bulk-upload', hasPermission('upload_qc_bulk'), upload.single('file'), bulkQCUpload);
router.post('/multi-entry', hasPermission('create_qc_multi'), multiQCEntry);
router.get('/template', hasPermission('view_qc'), getQCTemplate);

// Stats & Batches
router.get('/stats', hasPermission('view_qc'), getQCStats);
router.get('/batches', hasPermission('view_qc'), getQCBatches);
router.delete('/batch/:batchId', hasPermission('delete_qc'), deleteQCBatch);

// Filters
router.get('/brands', hasPermission('view_qc'), getQCBrands);
router.get('/categories', hasPermission('view_qc'), getQCCategories);

// Export
router.get('/export', exportQCData);

export default router;