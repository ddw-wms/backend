// File Path = warehouse-backend/src/routes/permissions.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as permissionsController from '../controllers/permissions.controller';
import * as approvalController from '../controllers/permissionApproval.controller';

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

// =============================================================
// Permission Approval Workflow
// =============================================================
router.get('/approval/pending-count', approvalController.getPendingCount);
router.get('/approval/requests', approvalController.getApprovalRequests);
router.get('/approval/requests/:id', approvalController.getApprovalRequestDetails);
router.get('/approval/my-requests', approvalController.getMyRequests);
router.post('/approval/role-request', approvalController.createRolePermissionRequest);
router.post('/approval/user-request', approvalController.createUserOverrideRequest);
router.put('/approval/requests/:id/changes', approvalController.updateChangeApproval);
router.post('/approval/requests/:id/finalize', approvalController.finalizeRequest);
router.delete('/approval/requests/:id', approvalController.cancelRequest);

export default router;
