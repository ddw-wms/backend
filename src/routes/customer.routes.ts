// File Path = warehouse-backend/src/routes/customer.routes.ts
import { Router } from 'express';
import { authMiddleware, hasRole } from '../middleware/auth.middleware';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerNames
} from '../controllers/customer.controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET routes - admin, manager, operator can view
router.get('/', hasRole('admin', 'manager', 'operator'), getCustomers);
router.get('/names', hasRole('admin', 'manager', 'operator', 'picker'), getCustomerNames);
router.get('/:id', hasRole('admin', 'manager', 'operator'), getCustomerById);

// POST routes - admin, operator can create
router.post('/', hasRole('admin', 'operator'), createCustomer);

// PUT routes - admin, operator can update
router.put('/:id', hasRole('admin', 'operator'), updateCustomer);

// DELETE routes - admin only
router.delete('/:id', hasRole('admin'), deleteCustomer);

export default router;