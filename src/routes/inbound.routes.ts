// File Path = warehouse-backend/src/routes/inbound.routes.ts
import express, { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authMiddleware, hasRole, hasPermission } from '../middleware/auth.middleware';
import * as inboundController from '../controllers/inbound.controller';
import { multiInboundEntry } from "../controllers/inbound.controller";


const router: Router = express.Router();

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.xlsx', '.xls'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format'));
    }
  }
});

// Routes - now using permission-based access control
router.post('/', authMiddleware, hasPermission('create_inbound_single'), inboundController.createInboundEntry);
router.get('/master-data/:wsn', authMiddleware, hasPermission('view_inbound'), inboundController.getMasterDataByWSN);
router.post('/bulk-upload', authMiddleware, hasPermission('upload_inbound_bulk'), upload.single('file'), inboundController.bulkInboundUpload);
router.post('/multi-entry', authMiddleware, hasPermission('create_inbound_multi'), inboundController.multiInboundEntry);
router.get('/', authMiddleware, hasPermission('view_inbound'), inboundController.getInboundList);
router.get('/batches', authMiddleware, hasPermission('view_inbound'), inboundController.getInboundBatches);
router.delete('/batches/:batchId', authMiddleware, hasPermission('delete_inbound'), inboundController.deleteInboundBatch);
router.get('/racks/:warehouseId', authMiddleware, hasPermission('view_inbound'), inboundController.getWarehouseRacks);

router.get('/brands', authMiddleware, inboundController.getBrands);
router.get('/categories', authMiddleware, inboundController.getCategories);
router.get('/wsns/all', authMiddleware, inboundController.getAllInboundWSNs);

export default router;