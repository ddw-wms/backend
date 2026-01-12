// File Path = warehouse-backend/src/routes/inbound.routes.ts
import express, { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authMiddleware, hasRole } from '../middleware/auth.middleware';
import {
  requirePermission,
  requireWarehouseAccess,
  injectWarehouseFilter
} from '../middleware/rbac.middleware';
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

// All routes require authentication
router.use(authMiddleware);

// View routes - require view permission and inject warehouse filter
router.get('/', injectWarehouseFilter, requirePermission('feature:inbound:view'), inboundController.getInboundList);
router.get('/batches', injectWarehouseFilter, requirePermission('feature:inbound:view'), inboundController.getInboundBatches);
router.get('/master-data/:wsn', requirePermission('feature:inbound:view'), inboundController.getMasterDataByWSN);
router.get('/brands', requirePermission('feature:inbound:view'), inboundController.getBrands);
router.get('/categories', requirePermission('feature:inbound:view'), inboundController.getCategories);
router.get('/wsns/all', injectWarehouseFilter, requirePermission('feature:inbound:view'), inboundController.getAllInboundWSNs);
router.get('/racks/:warehouseId', requireWarehouseAccess, requirePermission('feature:inbound:view'), inboundController.getWarehouseRacks);

// Create routes - require create permission and warehouse access
router.post('/', requireWarehouseAccess, requirePermission('feature:inbound:create'), inboundController.createInboundEntry);
router.post('/multi-entry', requireWarehouseAccess, requirePermission('feature:inbound:create'), inboundController.multiInboundEntry);

// Upload routes - require upload permission
router.post('/bulk-upload', requireWarehouseAccess, requirePermission('feature:inbound:upload'), upload.single('file'), inboundController.bulkInboundUpload);

// Delete routes - require delete permission
router.delete('/batches/:batchId', requirePermission('feature:inbound:delete'), inboundController.deleteInboundBatch);

export default router;