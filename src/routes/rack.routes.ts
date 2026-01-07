// File Path = warehouse-backend/src/routes/rack.routes.ts
import express, { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authMiddleware, hasRole, hasPermission } from '../middleware/auth.middleware';
import * as rackController from '../controllers/rack.controller';

const router: Router = express.Router();

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
  limits: { fileSize: 10 * 1024 * 1024 },
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

// GET routes - all authenticated users can view racks
router.get('/', rackController.getRacks);
router.get('/by-warehouse', rackController.getRacksByWarehouse);

// POST routes - permission-based
router.post('/', hasPermission('create_rack'), rackController.createRack);
router.post('/bulk-upload', hasPermission('create_rack'), upload.single('file'), rackController.bulkUploadRacks);

// PUT routes - permission-based
router.put('/:id', hasPermission('edit_rack'), rackController.updateRack);
router.patch('/:id/toggle', hasPermission('edit_rack'), rackController.toggleRackStatus);

// DELETE routes - permission-based
router.delete('/:id', hasPermission('delete_rack'), rackController.deleteRack);

export default router;
