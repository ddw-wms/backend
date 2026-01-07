// File Path = wms_backend/src/routes/permissions.routes.ts
import { Router } from 'express';
import * as permissionsController from '../controllers/permissions.controller';
import { authMiddleware, adminOnly, hasPermission } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get current user's permissions (no special permission needed)
router.get('/my-permissions', permissionsController.checkMyPermissions);

// Get all available permissions (for admin/managers)
router.get(
    '/all',
    hasPermission('view_permissions'),
    permissionsController.getAllPermissions
);

// Get permissions grouped by category
router.get(
    '/by-category',
    hasPermission('view_permissions'),
    permissionsController.getPermissionsByCategory
);

// Get all roles with permission counts
router.get(
    '/roles',
    hasPermission('view_permissions'),
    permissionsController.getRolesWithPermissions
);

// Get permissions for a specific role
router.get(
    '/roles/:role',
    hasPermission('view_permissions'),
    permissionsController.getRolePermissions
);

// Update a single role permission
router.put(
    '/roles/:role/:permissionKey',
    hasPermission('manage_permissions'),
    permissionsController.updateRolePermission
);

// Bulk update role permissions
router.post(
    '/roles/:role/bulk-update',
    hasPermission('manage_permissions'),
    permissionsController.bulkUpdateRolePermissions
);

// Reset role permissions to defaults
router.post(
    '/roles/:role/reset',
    hasPermission('manage_permissions'),
    permissionsController.resetRolePermissions
);

// Get user-specific permission overrides
router.get(
    '/users/:userId',
    hasPermission('view_permissions'),
    permissionsController.getUserPermissions
);

// Get effective permissions for a user (role + user overrides)
router.get(
    '/users/:userId/effective',
    hasPermission('view_permissions'),
    permissionsController.getEffectiveUserPermissions
);

// Update user-specific permission
router.put(
    '/users/:userId/:permissionKey',
    hasPermission('manage_permissions'),
    permissionsController.updateUserPermission
);

// Delete user-specific permission (revert to role default)
router.delete(
    '/users/:userId/:permissionKey',
    hasPermission('manage_permissions'),
    permissionsController.deleteUserPermission
);

export default router;
