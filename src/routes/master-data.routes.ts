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

// Template download
router.get('/download-template', ctrl.downloadTemplate);

// View routes
router.get('/', ctrl.getMasterData);
router.get('/batches', ctrl.getBatches);
router.get('/export', ctrl.exportMasterData);

// Upload routes
router.post('/upload', upload.single('file'), ctrl.uploadMasterData);
router.get('/upload/progress/:jobId', ctrl.getUploadProgress);
router.get('/upload/active', ctrl.getActiveUploads);
router.delete('/upload/cancel/:jobId', ctrl.cancelUpload);

// Delete routes
router.delete('/:id', ctrl.deleteMasterData);
router.delete('/batch/:batchId', ctrl.deleteBatch);

export default router;