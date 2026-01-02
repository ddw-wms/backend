// File Path = warehouse-backend/src/routes/outbound.routes.ts
import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, hasRole } from '../middleware/auth.middleware';
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
  getCategories
} from '../controllers/outbound.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication
router.use(authMiddleware);

// GET routes - admin, manager, operator
router.get('/all-wsns', hasRole('admin', 'manager', 'operator'), getAllOutboundWSNs);
router.get('/pending', hasRole('admin', 'manager', 'operator'), getPendingForOutbound);
router.get('/source-by-wsn', hasRole('admin', 'manager', 'operator'), getSourceByWSN);
router.get('/list', hasRole('admin', 'manager', 'operator'), getList);
router.get('/customers', hasRole('admin', 'manager', 'operator'), getCustomers);
router.get('/existing-wsns', hasRole('admin', 'manager', 'operator'), getExistingWSNs);
router.get('/batches', hasRole('admin', 'manager', 'operator'), getBatches);
router.get('/export', hasRole('admin', 'manager'), exportToExcel);
router.get('/brands', hasRole('admin', 'manager', 'operator'), getBrands);
router.get('/categories', hasRole('admin', 'manager', 'operator'), getCategories);

// POST routes - admin, operator
router.post('/single', hasRole('admin', 'operator'), createSingleEntry);
router.post('/multi', hasRole('admin', 'operator'), multiEntry);
router.post('/bulk', hasRole('admin', 'operator'), upload.single('file'), bulkUpload);

// DELETE routes - admin only
router.delete('/batch/:batchId', hasRole('admin'), deleteBatch);

export default router;