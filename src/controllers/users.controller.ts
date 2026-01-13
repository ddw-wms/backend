// File Path = warehouse-backend/src/controllers/users.controller.ts
import { Request, Response } from 'express';
import { query } from '../config/database';
import { hashPassword } from '../utils/helpers';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, username, email, full_name, phone, role, is_active, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const { username, password, email, full_name, phone, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hashedPassword = await hashPassword(password);
    const result = await query(
      `INSERT INTO users (username, password_hash, email, full_name, phone, role, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
       RETURNING id, username, email, full_name, role`,
      [username, hashedPassword, email || null, full_name || null, phone || null, role || 'operator']
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email, full_name, phone, role, is_active } = req.body;
    const currentUser = req.user;

    // Check if target user is super_admin
    const targetUser = await query('SELECT role FROM users WHERE id = $1', [id]);
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only super_admin can modify another super_admin
    if (targetUser.rows[0].role === 'super_admin' && currentUser?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only Super Admin can modify Super Admin users' });
    }

    // Prevent changing super_admin role (can't demote super_admin)
    if (targetUser.rows[0].role === 'super_admin' && role && role !== 'super_admin') {
      return res.status(403).json({ error: 'Cannot change Super Admin role' });
    }

    const result = await query(
      `UPDATE users
       SET email = COALESCE($1, email),
           full_name = COALESCE($2, full_name),
           phone = COALESCE($3, phone),
           role = COALESCE($4, role),
           is_active = COALESCE($5, is_active)
       WHERE id = $6
       RETURNING *`,
      [email, full_name, phone, role, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update user' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Check if target user is super_admin
    const targetUser = await query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cannot delete super_admin
    if (targetUser.rows[0].role === 'super_admin') {
      return res.status(403).json({ error: 'Super Admin cannot be deleted' });
    }

    // Cannot delete yourself
    if (targetUser.rows[0].id === currentUser?.userId) {
      return res.status(403).json({ error: 'You cannot delete yourself' });
    }

    await query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const currentUser = req.user;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if target user is super_admin
    const targetUser = await query('SELECT role FROM users WHERE id = $1', [id]);
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only super_admin can change another super_admin's password
    if (targetUser.rows[0].role === 'super_admin' && currentUser?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only Super Admin can change Super Admin password' });
    }

    const hashedPassword = await hashPassword(newPassword);
    const result = await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, username',
      [hashedPassword, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Password changed successfully', user: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get warehouses assigned to a user
export const getUserWarehouses = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Ensure user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await query(
      `SELECT uw.warehouse_id as id, w.name, w.code, uw.enabled
       FROM user_warehouses uw
       JOIN warehouses w ON uw.warehouse_id = w.id
       WHERE uw.user_id = $1`,
      [id]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Set warehouses for a user (body: { warehouseIds: number[] })
export const setUserWarehouses = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { warehouseIds } = req.body;

    if (!Array.isArray(warehouseIds)) {
      return res.status(400).json({ error: 'warehouseIds must be an array of integers' });
    }

    // Ensure user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Start transaction
    const pool = require('../config/database').getPool();
    const conn = await pool.connect();

    try {
      await conn.query('BEGIN');

      // Delete existing assignments
      await conn.query('DELETE FROM user_warehouses WHERE user_id = $1', [id]);

      // Insert new ones
      if (warehouseIds.length > 0) {
        const values = warehouseIds.map((w: number, idx: number) => `($1, $${idx + 2}, true)`).join(',');
        const params: any[] = [id, ...warehouseIds];
        await conn.query(
          `INSERT INTO user_warehouses (user_id, warehouse_id, enabled) VALUES ${values}`,
          params
        );
      }

      await conn.query('COMMIT');
      res.json({ message: 'User warehouses updated', count: warehouseIds.length });
    } catch (err) {
      await conn.query('ROLLBACK');
      throw err;
    } finally {
      conn.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
