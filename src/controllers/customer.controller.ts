// File Path = warehouse-backend/src/controllers/customer.controller.ts
import { Request, Response } from 'express';
import { query } from '../config/database';

// ====== GET ALL CUSTOMERS ======
export const getCustomers = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.query;

    if (!warehouseId) {
      return res.status(400).json({ error: 'Warehouse ID required' });
    }

    const sql = `
      SELECT 
        id, name, contact_person, phone, email, address, 
        warehouse_id, created_at, updated_at
      FROM customers
      WHERE warehouse_id = $1
      ORDER BY name ASC
    `;

    const result = await query(sql, [warehouseId]);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====== GET SINGLE CUSTOMER ======
export const getCustomerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // ⚡ EGRESS OPTIMIZATION: Select only needed columns
    const sql = `SELECT id, name, contact_person, phone, email, address, 
                        warehouse_id, created_at, updated_at 
                 FROM customers WHERE id = $1`;
    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Get customer by ID error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====== CREATE CUSTOMER ======
export const createCustomer = async (req: Request, res: Response) => {
  try {
    const { name, contact_person, phone, email, address, warehouse_id } = req.body;

    if (!name || !warehouse_id) {
      return res.status(400).json({ error: 'Name and warehouse_id are required' });
    }

    // Check duplicate name in same warehouse
    const checkSql = `
      SELECT id FROM customers 
      WHERE LOWER(name) = LOWER($1) AND warehouse_id = $2
    `;
    const checkResult = await query(checkSql, [name, warehouse_id]);

    if (checkResult.rows.length > 0) {
      return res.status(409).json({ error: 'Customer name already exists in this warehouse' });
    }

    const sql = `
      INSERT INTO customers (
        name, contact_person, phone, email, address, warehouse_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await query(sql, [
      name,
      contact_person || null,
      phone || null,
      email || null,
      address || null,
      warehouse_id
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====== UPDATE CUSTOMER ======
export const updateCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, contact_person, phone, email, address } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Check if customer exists
    const checkSql = `SELECT warehouse_id FROM customers WHERE id = $1`;
    const checkResult = await query(checkSql, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const warehouseId = checkResult.rows[0].warehouse_id;

    // Check duplicate name (excluding current customer)
    const dupSql = `
      SELECT id FROM customers 
      WHERE LOWER(name) = LOWER($1) AND warehouse_id = $2 AND id != $3
    `;
    const dupResult = await query(dupSql, [name, warehouseId, id]);

    if (dupResult.rows.length > 0) {
      return res.status(409).json({ error: 'Customer name already exists in this warehouse' });
    }

    const sql = `
      UPDATE customers SET
        name = $1,
        contact_person = $2,
        phone = $3,
        email = $4,
        address = $5,
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;

    const result = await query(sql, [
      name,
      contact_person || null,
      phone || null,
      email || null,
      address || null,
      id
    ]);

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====== DELETE CUSTOMER ======
export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if customer has any outbound entries
    const checkOutbound = `
      SELECT COUNT(*) as count FROM outbound WHERE customer_name = (
        SELECT name FROM customers WHERE id = $1
      )
    `;
    const checkResult = await query(checkOutbound, [id]);

    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete customer with existing outbound entries'
      });
    }

    const sql = `DELETE FROM customers WHERE id = $1 RETURNING *`;
    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ message: 'Customer deleted successfully' });
  } catch (error: any) {
    console.error('Delete customer error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====== GET CUSTOMER NAMES FOR DROPDOWN ======
export const getCustomerNames = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.query;

    if (!warehouseId) {
      return res.status(400).json({ error: 'Warehouse ID required' });
    }

    const sql = `
      SELECT DISTINCT name 
      FROM customers 
      WHERE warehouse_id = $1 
      ORDER BY name ASC
    `;

    const result = await query(sql, [warehouseId]);
    res.json(result.rows.map((r: any) => r.name));
  } catch (error: any) {
    console.error('Get customer names error:', error);
    res.status(500).json({ error: error.message });
  }
};