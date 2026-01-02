// File Path = warehouse-backend/src/routes/inbound.routes.ts
import express, { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authMiddleware, hasRole } from '../middleware/auth.middleware';
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

// Routes - admin, manager, operator can access
router.post('/', authMiddleware, hasRole('admin', 'manager', 'operator'), inboundController.createInboundEntry);
router.get('/master-data/:wsn', authMiddleware, hasRole('admin', 'manager', 'operator'), inboundController.getMasterDataByWSN);
router.post('/bulk-upload', authMiddleware, hasRole('admin', 'manager', 'operator'), upload.single('file'), inboundController.bulkInboundUpload);
router.post('/multi-entry', authMiddleware, hasRole('admin', 'manager', 'operator'), inboundController.multiInboundEntry);
router.get('/', authMiddleware, hasRole('admin', 'manager', 'operator'), inboundController.getInboundList);
router.get('/batches', authMiddleware, hasRole('admin', 'manager', 'operator'), inboundController.getInboundBatches);
router.delete('/batches/:batchId', authMiddleware, hasRole('admin', 'operator'), inboundController.deleteInboundBatch); // Only admin and operator can delete
router.get('/racks/:warehouseId', authMiddleware, hasRole('admin', 'manager', 'operator'), inboundController.getWarehouseRacks);

router.get('/brands', authMiddleware, inboundController.getBrands);
router.get('/categories', authMiddleware, inboundController.getCategories);
router.get('/wsns/all', authMiddleware, inboundController.getAllInboundWSNs);

export default router;