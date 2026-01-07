// File Path = warehouse-backend/src/routes/outbound.routes.ts
import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, hasRole, hasPermission } from '../middleware/auth.middleware';
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

// GET routes - permission-based access
router.get('/all-wsns', hasPermission('view_outbound'), getAllOutboundWSNs);
router.get('/pending', hasPermission('view_outbound'), getPendingForOutbound);
router.get('/source-by-wsn', hasPermission('view_outbound'), getSourceByWSN);
router.get('/list', hasPermission('view_outbound'), getList);
router.get('/customers', hasPermission('view_outbound'), getCustomers);
router.get('/existing-wsns', hasPermission('view_outbound'), getExistingWSNs);
router.get('/batches', hasPermission('view_outbound'), getBatches);
router.get('/export', hasPermission('export_outbound'), exportToExcel);
router.get('/brands', hasPermission('view_outbound'), getBrands);
router.get('/categories', hasPermission('view_outbound'), getCategories);
router.get('/sources', hasPermission('view_outbound'), getSources);

// POST routes - permission-based access
router.post('/single', hasPermission('create_outbound_single'), createSingleEntry);
router.post('/multi', hasPermission('create_outbound_multi'), multiEntry);
router.post('/bulk', hasPermission('upload_outbound_bulk'), upload.single('file'), bulkUpload);

// DELETE routes - permission-based access
router.delete('/batch/:batchId', hasPermission('delete_outbound'), deleteBatch);

export default router;