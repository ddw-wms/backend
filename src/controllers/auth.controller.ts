// File Path = warehouse-backend/src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { query } from '../config/database';
import { generateToken } from '../config/auth';
import { hashPassword, comparePasswords } from '../utils/helpers';
import { validateEmail, validatePassword, validateUsername } from '../utils/validators';

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const result = await query(
      'SELECT * FROM users WHERE username = $1 AND is_active = true',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValidPassword = await comparePasswords(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Build permission map - handle case when RBAC tables don't exist
    let permissions: Record<string, { can_access: boolean; is_visible: boolean }> = {};
    let warehousesList: any[] = [];

    // Try to fetch user permissions from RBAC system
    try {
      const permissionsResult = await query(`
        SELECT 
          permission_code, can_access, is_visible
        FROM effective_user_permissions
        WHERE user_id = $1 AND can_access = true
      `, [user.id]);

      for (const p of permissionsResult.rows) {
        permissions[p.permission_code] = {
          can_access: p.can_access,
          is_visible: p.is_visible
        };
      }
    } catch (permError: any) {
      // Permissions tables don't exist - use legacy role-based access
      console.log('Permission tables not found, using legacy role-based access');
      if (user.role === 'admin' || user.role === 'super_admin') {
        permissions = { '__legacy_admin__': { can_access: true, is_visible: true } };
      }
    }

    // Fetch accessible warehouses - SEPARATE from permissions
    try {
      // First try user_warehouses table directly (more reliable than view)
      const warehousesResult = await query(`
        SELECT DISTINCT
          uw.warehouse_id, 
          w.name as warehouse_name, 
          w.code as warehouse_code, 
          uw.is_default
        FROM user_warehouses uw
        JOIN warehouses w ON w.id = uw.warehouse_id
        WHERE uw.user_id = $1 AND w.is_active = true
      `, [user.id]);

      warehousesList = warehousesResult.rows;

      // If user has warehouse restrictions, use them
      // If empty, user has access to ALL warehouses (no restriction)
      console.log(`User ${user.username} warehouse access: ${warehousesList.length > 0 ? warehousesList.map(w => w.warehouse_name).join(', ') : 'ALL (no restrictions)'}`);
    } catch (whError: any) {
      console.log('user_warehouses table not found, using legacy warehouse_id');
      // Fallback to legacy warehouse_id
      if (user.warehouse_id) {
        const whResult = await query('SELECT id, name, code FROM warehouses WHERE id = $1', [user.warehouse_id]);
        if (whResult.rows.length > 0) {
          warehousesList = [{
            warehouse_id: whResult.rows[0].id,
            warehouse_name: whResult.rows[0].name,
            warehouse_code: whResult.rows[0].code,
            is_default: true
          }];
        }
      }
    }

    const token = generateToken({
      userId: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      warehouseId: user.warehouse_id,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        warehouseId: user.warehouse_id,
        permissions,
        warehouses: warehousesList,
        defaultWarehouseId: warehousesList.find((w: any) => w.is_default)?.warehouse_id || user.warehouse_id
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { username, password, email, fullName } = req.body;

    if (!validateUsername(username)) {
      return res.status(400).json({ error: 'Invalid username (3-50 chars required)' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Password must be 6+ characters' });
    }

    if (email && !validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const existingUser = await query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hashedPassword = await hashPassword(password);

    const result = await query(
      `INSERT INTO users (username, password_hash, email, full_name, role, is_active, created_at)
       VALUES ($1, $2, $3, $4, 'operator', true, NOW())
       RETURNING id, username, email, full_name, role`,
      [username, hashedPassword, email || null, fullName || null]
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0],
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ error: error.message });
  }
};
