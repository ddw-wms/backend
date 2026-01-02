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
import { upload } from '../middleware/upload.middleware';

const router = Router();

// Base authentication for all routes
router.use(authMiddleware);

// Pending items - admin, manager, qc can view
router.get('/pending-inbound', hasRole('admin', 'manager', 'qc'), getPendingInboundForQC);

// Get all QC'd WSNs (for duplicate checking) - admin, manager, qc
router.get('/wsns/all', hasRole('admin', 'manager', 'qc'), getAllQCWSNs);

// QC List & Operations
router.get('/list', hasRole('admin', 'manager', 'qc'), getQCList);
router.post('/create', hasRole('admin', 'qc'), createQCEntry); // Only admin and qc can create
router.delete('/delete/:qcId', hasRole('admin'), deleteQCEntry); // Only admin can delete

// Bulk & Multi - only admin and qc
router.post('/bulk-upload', hasRole('admin', 'qc'), upload.single('file'), bulkQCUpload);
router.post('/multi-entry', hasRole('admin', 'qc'), multiQCEntry);
router.get('/template', hasRole('admin', 'manager', 'qc'), getQCTemplate);

// Stats & Batches - admin, manager, qc can view
router.get('/stats', hasRole('admin', 'manager', 'qc'), getQCStats);
router.get('/batches', hasRole('admin', 'manager', 'qc'), getQCBatches);
router.delete('/batch/:batchId', hasRole('admin'), deleteQCBatch); // Only admin can delete

// Filters - admin, manager, qc can view
router.get('/brands', hasRole('admin', 'manager', 'qc'), getQCBrands);
router.get('/categories', hasRole('admin', 'manager', 'qc'), getQCCategories);

// Export
router.get('/export', exportQCData);

export default router;