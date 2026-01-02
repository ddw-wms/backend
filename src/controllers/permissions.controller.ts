// File Path = warehouse-backend/src/controllers/permissions.controller.ts
import { Request, Response } from 'express';
import pool from '../config/database';

// Get all role permissions
export const getAllPermissions = async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            'SELECT * FROM role_permissions ORDER BY role, permission_key'
        );

        // Return raw array for frontend processing
        res.json(result.rows);
    } catch (error: any) {
        console.error('Error fetching permissions:', error);
        res.status(500).json({ error: 'Failed to fetch permissions', message: error.message });
    }
};

// Save permissions for a specific role
export const saveRolePermissions = async (req: Request, res: Response) => {
    const { role, permissions } = req.body;

    if (!role || !permissions) {
        return res.status(400).json({ error: 'Role and permissions are required' });
    }

    try {
        // Delete existing permissions for this role
        await pool.query('DELETE FROM role_permissions WHERE role = $1', [role]);

        // Insert new permissions
        const insertPromises = Object.entries(permissions).map(([permKey, enabled]) => {
            return pool.query(
                'INSERT INTO role_permissions (role, permission_key, enabled) VALUES ($1, $2, $3)',
                [role, permKey, enabled]
            );
        });

        await Promise.all(insertPromises);

        res.json({ message: 'Permissions saved successfully', role });
    } catch (error: any) {
        console.error('Error saving permissions:', error);
        res.status(500).json({ error: 'Failed to save permissions' });
    }
};

// Save all permissions at once
export const saveAllPermissions = async (req: Request, res: Response) => {
    const { permissions } = req.body;

    if (!permissions || !Array.isArray(permissions)) {
        return res.status(400).json({ error: 'Permissions array is required' });
    }

    try {
        // Start transaction
        await pool.query('BEGIN');

        // Delete all existing permissions
        await pool.query('TRUNCATE TABLE role_permissions');

        // Insert all new permissions
        const insertPromises: Promise<any>[] = [];

        permissions.forEach((perm: any) => {
            insertPromises.push(
                pool.query(
                    'INSERT INTO role_permissions (role, permission_key, enabled) VALUES ($1, $2, $3)',
                    [perm.role, perm.permission_key, perm.enabled]
                )
            );
        });

        await Promise.all(insertPromises);

        // Commit transaction
        await pool.query('COMMIT');

        res.json({ message: 'All permissions saved successfully', count: permissions.length });
    } catch (error: any) {
        await pool.query('ROLLBACK');
        console.error('Error saving all permissions:', error);
        res.status(500).json({ error: 'Failed to save permissions', message: error.message });
    }
};

// Check if user has specific permission
export const checkUserPermission = async (req: Request, res: Response) => {
    const { userId, permissionKey } = req.query;

    if (!userId || !permissionKey) {
        return res.status(400).json({ error: 'userId and permissionKey are required' });
    }

    try {
        // Get user role
        const userResult = await pool.query(
            'SELECT role FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const role = userResult.rows[0].role;

        // Check permission
        const permResult = await pool.query(
            'SELECT enabled FROM role_permissions WHERE role = $1 AND permission_key = $2',
            [role, permissionKey]
        );

        const hasPermission = permResult.rows.length > 0 && permResult.rows[0].enabled;

        res.json({ hasPermission, role, permissionKey });
    } catch (error: any) {
        console.error('Error checking permission:', error);
        res.status(500).json({ error: 'Failed to check permission' });
    }
};

// Get permissions for current user
export const getCurrentUserPermissions = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get user role
        const userResult = await pool.query(
            'SELECT role FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const role = userResult.rows[0].role;

        // Get all permissions for this role
        const permResult = await pool.query(
            'SELECT permission_key, enabled FROM role_permissions WHERE role = $1',
            [role]
        );

        const permissions: any = {};
        permResult.rows.forEach((row: any) => {
            permissions[row.permission_key] = row.enabled;
        });

        res.json({ role, permissions });
    } catch (error: any) {
        console.error('Error fetching user permissions:', error);
        res.status(500).json({ error: 'Failed to fetch user permissions' });
    }
};
