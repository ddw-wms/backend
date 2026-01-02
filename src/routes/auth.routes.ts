// File Path = warehouse-backend/src/routes/auth.routes.ts
import express, { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { loginRateLimit } from '../middleware/rateLimit.middleware';

const router: Router = express.Router();

// Apply rate limiting to login (5 attempts per 15 minutes)
router.post('/login', loginRateLimit, authController.login);
router.post('/register', authController.register);

export default router;
