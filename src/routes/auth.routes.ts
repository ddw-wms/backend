// File Path = warehouse-backend/src/routes/auth.routes.ts
import express, { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { loginRateLimit } from '../middleware/rateLimit.middleware';
import { authMiddleware, hasRole } from '../middleware/auth.middleware';

const router: Router = express.Router();

// Apply rate limiting to login (5 attempts per 15 minutes)
router.post('/login', loginRateLimit, authController.login);

// Register is now admin-only (no public registration)
// Only authenticated admins can create new users
router.post('/register', authMiddleware, hasRole('admin', 'super_admin'), authController.register);

export default router;
