// File Path = warehouse-backend/src/routes/ui-access.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import * as uiAccessController from '../controllers/ui-access.controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get my UI access (for current user)
router.get('/my-access', uiAccessController.getMyAccess);

// Get all UI elements
router.get('/elements', uiAccessController.getAllElements);

// Roles management
router.get('/roles', uiAccessController.getRoles);
router.post('/roles', uiAccessController.createRole);
router.delete('/roles/:roleId', uiAccessController.deleteRole);

// Role access management
router.get('/roles/:roleId/access', uiAccessController.getRoleAccess);
router.put('/roles/:roleId/access', uiAccessController.updateRoleAccess);

// User overrides management
router.get('/users/:userId/overrides', uiAccessController.getUserOverrides);
router.put('/users/:userId/overrides', uiAccessController.updateUserOverrides);

// User warehouses
router.get('/users/:userId/warehouses', uiAccessController.getUserWarehouses);
router.put('/users/:userId/warehouses', uiAccessController.updateUserWarehouses);

export default router;
