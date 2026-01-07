// File Path = warehouse-backend/src/routes/users.routes.ts
import express, { Router } from 'express';
import { authMiddleware, adminOnly, hasPermission } from '../middleware/auth.middleware';
import * as usersController from '../controllers/users.controller';

const router: Router = express.Router();

router.get('/', authMiddleware, hasPermission('view_users'), usersController.getUsers);
router.post('/', authMiddleware, hasPermission('create_user'), usersController.createUser);
router.put('/:id', authMiddleware, hasPermission('edit_user'), usersController.updateUser);
router.delete('/:id', authMiddleware, hasPermission('delete_user'), usersController.deleteUser);
router.patch('/:id/change-password', authMiddleware, hasPermission('edit_user'), usersController.changePassword);

export default router;
