// File Path = warehouse-backend/src/routes/permissions.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as permissionsController from '../controllers/permissions.controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// =============================================================
// Current User's Permissions
// =============================================================
router.get('/me', permissionsController.getMyPermissions);
router.get('/check/:code', permissionsController.checkPermission);

// =============================================================
// All Permissions List
// =============================================================
router.get('/', permissionsController.getAllPermissions);

// =============================================================
// Roles Management
// =============================================================
router.get('/roles', permissionsController.getRoles);
router.get('/roles/:roleId/permissions', permissionsController.getRolePermissions);
router.put('/roles/:roleId/permissions', permissionsController.updateRolePermissions);

// =============================================================
// User Overrides
// =============================================================
router.get('/users/:userId/overrides', permissionsController.getUserOverrides);
router.put('/users/:userId/overrides', permissionsController.updateUserOverrides);

// =============================================================
// User Warehouses
// =============================================================
router.get('/users/:userId/warehouses', permissionsController.getUserWarehouses);
router.put('/users/:userId/warehouses', permissionsController.updateUserWarehouses);

export default router;
