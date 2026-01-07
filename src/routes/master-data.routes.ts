// File Path = warehouse-backend/src/routes/master-data.routes.ts
import express, { NextFunction, Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware, hasRole, hasPermission } from '../middleware/auth.middleware';
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

// Template download
router.get('/download-template', hasPermission('view_master_data'), ctrl.downloadTemplate);

// View routes
router.get('/', hasPermission('view_master_data'), ctrl.getMasterData);
router.get('/batches', hasPermission('view_master_data'), ctrl.getBatches);
router.get('/export', hasPermission('export_master_data'), ctrl.exportMasterData);

// Upload routes
router.post('/upload', hasPermission('create_master_data'), upload.single('file'), ctrl.uploadMasterData);
router.get('/upload/progress/:jobId', hasPermission('view_master_data'), ctrl.getUploadProgress);
router.get('/upload/active', hasPermission('view_master_data'), ctrl.getActiveUploads);
router.delete('/upload/cancel/:jobId', hasPermission('create_master_data'), ctrl.cancelUpload);

// Delete routes
router.delete('/:id', hasPermission('delete_master_data'), ctrl.deleteMasterData);
router.delete('/batch/:batchId', hasPermission('delete_master_data'), ctrl.deleteBatch);

export default router;