// File Path = warehouse-backend/src/routes/permissions.routes.ts
import { Router } from 'express';
import {
    getAllPermissions,
    saveRolePermissions,
    saveAllPermissions,
    checkUserPermission,
    getCurrentUserPermissions
} from '../controllers/permissions.controller';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get all role permissions (admin only)
router.get('/all', adminOnly, getAllPermissions);

// Save permissions for specific role (admin only)
router.post('/role', adminOnly, saveRolePermissions);

// Save all permissions at once (admin only)
router.post('/save-all', adminOnly, saveAllPermissions);

// Check specific permission (any authenticated user)
router.get('/check', checkUserPermission);

// Get current user's permissions
router.get('/my-permissions', getCurrentUserPermissions);

export default router;
