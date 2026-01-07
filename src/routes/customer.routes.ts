// File Path = warehouse-backend/src/routes/customer.routes.ts
import { Router } from 'express';
import { authMiddleware, hasRole, hasPermission } from '../middleware/auth.middleware';
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

// GET routes - permission-based access
router.get('/', hasPermission('view_customers'), getCustomers);
router.get('/names', hasPermission('view_customers'), getCustomerNames);
router.get('/:id', hasPermission('view_customers'), getCustomerById);

// POST routes
router.post('/', hasPermission('create_customer'), createCustomer);

// PUT routes
router.put('/:id', hasPermission('edit_customer'), updateCustomer);

// DELETE routes
router.delete('/:id', hasPermission('delete_customer'), deleteCustomer);

export default router;