import { Router } from 'express';
import {
  getSourceByWSN,
  multiPickingEntry,
  getPickingList,
  getCustomers,
  checkWSNExists,
  getExistingWSNs,
  getBatches,
  deleteBatch
} from '../controllers/picking.controller';

const router = Router();

// GET source data by WSN (QC → INBOUND → MASTER priority)
router.get('/source-by-wsn', getSourceByWSN);

// POST multi-entry with auto batch ID
router.post('/multi-entry', multiPickingEntry);

// GET picking list with filters & pagination
router.get('/list', getPickingList);

// GET customers from customers table
router.get('/customers', getCustomers);

// GET check if WSN exists
router.get('/check-wsn', checkWSNExists);

// GET all existing WSNs
router.get('/existing-wsns', getExistingWSNs);

// GET batches
router.get('/batches', getBatches);

// DELETE batch
router.delete('/batch/:batchId', deleteBatch);

export default router;