import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerNames
} from '../controllers/customer.controller';

const router = Router();

// GET routes
router.get('/', getCustomers);           // Get all customers for warehouse
router.get('/names', getCustomerNames);  // Get customer names for dropdown
router.get('/:id', getCustomerById);     // Get single customer

// POST routes
router.post('/', createCustomer);        // Create new customer

// PUT routes
router.put('/:id', updateCustomer);      // Update customer

// DELETE routes
router.delete('/:id', deleteCustomer);   // Delete customer

export default router;