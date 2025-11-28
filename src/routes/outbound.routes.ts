import { Router } from 'express';
import multer from 'multer';
import {
  getSourceByWSN,
  multiEntry,
  bulkUpload,
  getList,
  getCustomers,
  getExistingWSNs,
  getBatches,
  deleteBatch
} from '../controllers/outbound.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET routes
router.get('/source-by-wsn', getSourceByWSN);
router.get('/list', getList);
router.get('/customers', getCustomers);
router.get('/existing-wsns', getExistingWSNs);
router.get('/batches', getBatches);

// POST routes
router.post('/multi', multiEntry);
router.post('/bulk', upload.single('file'), bulkUpload); // ✅ multer added

// DELETE routes
router.delete('/batch/:batchId', deleteBatch);

export default router;