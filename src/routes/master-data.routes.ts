// File Path = warehouse-backend/src/routes/master-data.routes.ts
import express, { NextFunction, Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware, hasRole } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/master-data.controller';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('Invalid file type'));
  }
});

// All routes require authentication
router.use(authMiddleware);

// Template download - admin, manager, operator
router.get('/download-template', hasRole('admin', 'manager', 'operator'), ctrl.downloadTemplate);

// View routes - admin, manager, operator
router.get('/', hasRole('admin', 'manager', 'operator'), ctrl.getMasterData);
router.get('/batches', hasRole('admin', 'manager', 'operator'), ctrl.getBatches);
router.get('/export', hasRole('admin', 'manager', 'operator'), ctrl.exportMasterData);

// Upload routes - admin, operator
router.post('/upload', hasRole('admin', 'operator'), upload.single('file'), ctrl.uploadMasterData);
router.get('/upload/progress/:jobId', hasRole('admin', 'manager', 'operator'), ctrl.getUploadProgress);
router.get('/upload/active', hasRole('admin', 'manager', 'operator'), ctrl.getActiveUploads);
router.delete('/upload/cancel/:jobId', hasRole('admin', 'operator'), ctrl.cancelUpload);

// Delete routes - admin only
router.delete('/:id', hasRole('admin'), ctrl.deleteMasterData);
router.delete('/batch/:batchId', hasRole('admin'), ctrl.deleteBatch);

export default router;