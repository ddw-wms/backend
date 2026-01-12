// File Path = warehouse-backend/src/controllers/permissions.controller.ts
// Final Permissions Controller - Enable/Disable + Show/Hide

import { Request, Response } from 'express';
import { query } from '../config/database';

// =============================================================
// GET ALL PERMISSIONS (grouped by page)
// =============================================================
export const getAllPermissions = async (req: Request, res: Response) => {
    try {
        const result = await query(`
            SELECT code, name, category, page, parent_code, sort_order
            FROM permissions
            ORDER BY sort_order
        `);

        // Group by page
        const grouped: Record<string, any[]> = {};
        result.rows.forEach(row => {
            if (!grouped[row.page]) {
                grouped[row.page] = [];
            }
            grouped[row.page].push(row);
        });

        res.json({
            permissions: result.rows,
            grouped
        });
    } catch (error: any) {
        console.error('Get all permissions error:', error);
        res.status(500).json({ error: error.message });
    }
};

// =============================================================
// GET MY PERMISSIONS (for current logged-in user)
// =============================================================
export const getMyPermissions = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;

        // Super admin gets everything enabled and visible
        if (user.role === 'super_admin' || user.role === 'admin') {
            const perms = await query(`
                SELECT code, name, category, page
                FROM permissions
                ORDER BY sort_order
            `);

            const permissions: Record<string, any> = {};
            perms.rows.forEach(p => {
                permissions[p.code] = {
                    name: p.name,
                    category: p.category,
                    page: p.page,
                    is_enabled: true,
                    is_visible: true,
                    source: 'admin'
                };
            });

            return res.json({
                permissions,
                role: user.role,
                isAdmin: true
            });
        }

        // Regular users - get from effective_user_permissions view
        const result = await query(`
            SELECT 
                permission_code as code,
                permission_name as name,
                category,
                page,
                is_enabled,
                is_visible,
                permission_source as source
            FROM effective_user_permissions
            WHERE user_id = $1
            ORDER BY sort_order
        `, [user.userId]);

        const permissions: Record<string, any> = {};
        result.rows.forEach(p => {
            permissions[p.code] = {
                name: p.name,
                category: p.category,
                page: p.page,
                is_enabled: p.is_enabled,
                is_visible: p.is_visible,
                source: p.source
            };
        });

        res.json({
            permissions,
            role: user.role,
            isAdmin: false
        });
    } catch (error: any) {
        console.error('Get my permissions error:', error);
        // Fallback for admin
        const user = (req as any).user;
        if (user.role === 'super_admin' || user.role === 'admin') {
            return res.json({ permissions: {}, role: user.role, isAdmin: true, legacy: true });
        }
        res.status(500).json({ error: error.message });
    }
};

// =============================================================
// GET ALL ROLES
// =============================================================
export const getRoles = async (req: Request, res: Response) => {
    try {
        const result = await query(`
            SELECT 
                r.id, r.name, r.description, r.is_system_role, r.is_active, r.priority,
                COUNT(DISTINCT u.id) as user_count
            FROM roles r
            LEFT JOIN users u ON u.role = r.name AND u.is_active = true
            GROUP BY r.id
            ORDER BY r.priority DESC
        `);

        res.json(result.rows);
    } catch (error: any) {
        console.error('Get roles error:', error);
        res.status(500).json({ error: error.message });
    }
};

// =============================================================
// GET ROLE PERMISSIONS
// =============================================================
export const getRolePermissions = async (req: Request, res: Response) => {
    try {
        const { roleId } = req.params;

        const result = await query(`
            SELECT 
                p.code,
                p.name,
                p.category,
                p.page,
                p.parent_code,
                p.sort_order,
                COALESCE(rp.is_enabled, false) as is_enabled,
                COALESCE(rp.is_visible, false) as is_visible
            FROM permissions p
            LEFT JOIN role_permissions rp ON rp.permission_code = p.code AND rp.role_id = $1
            ORDER BY p.sort_order
        `, [roleId]);

        res.json(result.rows);
    } catch (error: any) {
        console.error('Get role permissions error:', error);
        res.status(500).json({ error: error.message });
    }
};

// =============================================================
// UPDATE ROLE PERMISSIONS
// =============================================================
export const updateRolePermissions = async (req: Request, res: Response) => {
    try {
        const { roleId } = req.params;
        const { permissions } = req.body; // Array of { code, is_enabled, is_visible }

        if (!Array.isArray(permissions)) {
            return res.status(400).json({ error: 'Permissions array required' });
        }

        await query('BEGIN');

        for (const perm of permissions) {
            await query(`
                INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (role_id, permission_code)
                DO UPDATE SET 
                    is_enabled = $3, 
                    is_visible = $4,
                    updated_at = NOW()
            `, [roleId, perm.code, perm.is_enabled, perm.is_visible]);
        }

        await query('COMMIT');

        res.json({ success: true, message: 'Role permissions updated' });
    } catch (error: any) {
        await query('ROLLBACK');
        console.error('Update role permissions error:', error);
        res.status(500).json({ error: error.message });
    }
};

// =============================================================
// GET USER OVERRIDES
// =============================================================
export const getUserOverrides = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        // Get user's role first
        const userResult = await query('SELECT role FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const userRole = userResult.rows[0].role;

        // Get role's default permissions with user overrides
        const result = await query(`
            SELECT 
                p.code,
                p.name,
                p.category,
                p.page,
                p.parent_code,
                p.sort_order,
                COALESCE(rp.is_enabled, false) as role_enabled,
                COALESCE(rp.is_visible, false) as role_visible,
                upo.is_enabled as override_enabled,
                upo.is_visible as override_visible,
                COALESCE(upo.is_enabled, rp.is_enabled, false) as effective_enabled,
                COALESCE(upo.is_visible, rp.is_visible, false) as effective_visible
            FROM permissions p
            LEFT JOIN roles r ON r.name = $2
            LEFT JOIN role_permissions rp ON rp.permission_code = p.code AND rp.role_id = r.id
            LEFT JOIN user_permission_overrides upo ON upo.permission_code = p.code AND upo.user_id = $1
            ORDER BY p.sort_order
        `, [userId, userRole]);

        res.json({
            userRole,
            permissions: result.rows
        });
    } catch (error: any) {
        console.error('Get user overrides error:', error);
        res.status(500).json({ error: error.message });
    }
};

// =============================================================
// UPDATE USER OVERRIDES
// =============================================================
export const updateUserOverrides = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { overrides } = req.body; // Array of { code, is_enabled, is_visible } - null values mean use role default

        if (!Array.isArray(overrides)) {
            return res.status(400).json({ error: 'Overrides array required' });
        }

        await query('BEGIN');

        // First, delete all existing overrides for this user
        await query('DELETE FROM user_permission_overrides WHERE user_id = $1', [userId]);

        // Insert new overrides (only where is_enabled or is_visible is not null)
        for (const ovr of overrides) {
            if (ovr.is_enabled !== null || ovr.is_visible !== null) {
                await query(`
                    INSERT INTO user_permission_overrides (user_id, permission_code, is_enabled, is_visible)
                    VALUES ($1, $2, $3, $4)
                `, [userId, ovr.code, ovr.is_enabled, ovr.is_visible]);
            }
        }

        await query('COMMIT');

        res.json({ success: true, message: 'User overrides updated' });
    } catch (error: any) {
        await query('ROLLBACK');
        console.error('Update user overrides error:', error);
        res.status(500).json({ error: error.message });
    }
};

// =============================================================
// GET USER WAREHOUSES
// =============================================================
export const getUserWarehouses = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        const result = await query(`
            SELECT 
                uw.warehouse_id,
                w.name as warehouse_name,
                w.code as warehouse_code,
                uw.is_default
            FROM user_warehouses uw
            JOIN warehouses w ON w.id = uw.warehouse_id
            WHERE uw.user_id = $1 AND w.is_active = true
            ORDER BY uw.is_default DESC, w.name
        `, [userId]);

        res.json(result.rows);
    } catch (error: any) {
        console.error('Get user warehouses error:', error);
        res.status(500).json({ error: error.message });
    }
};

// =============================================================
// UPDATE USER WAREHOUSES
// =============================================================
export const updateUserWarehouses = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { warehouse_ids, default_warehouse_id } = req.body;

        if (!Array.isArray(warehouse_ids)) {
            return res.status(400).json({ error: 'warehouse_ids array required' });
        }

        await query('BEGIN');

        // Delete existing warehouse assignments
        await query('DELETE FROM user_warehouses WHERE user_id = $1', [userId]);

        // Insert new assignments
        for (const whId of warehouse_ids) {
            await query(`
                INSERT INTO user_warehouses (user_id, warehouse_id, is_default)
                VALUES ($1, $2, $3)
            `, [userId, whId, whId === default_warehouse_id]);
        }

        await query('COMMIT');

        res.json({ success: true, message: 'User warehouses updated' });
    } catch (error: any) {
        await query('ROLLBACK');
        console.error('Update user warehouses error:', error);
        res.status(500).json({ error: error.message });
    }
};

// =============================================================
// CHECK PERMISSION (API endpoint for frontend)
// =============================================================
export const checkPermission = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { code } = req.params;

        // Admin always has permission
        if (user.role === 'super_admin' || user.role === 'admin') {
            return res.json({
                code,
                is_enabled: true,
                is_visible: true
            });
        }

        const result = await query(`
            SELECT is_enabled, is_visible
            FROM effective_user_permissions
            WHERE user_id = $1 AND permission_code = $2
        `, [user.userId, code]);

        if (result.rows.length === 0) {
            return res.json({
                code,
                is_enabled: false,
                is_visible: false
            });
        }

        res.json({
            code,
            is_enabled: result.rows[0].is_enabled,
            is_visible: result.rows[0].is_visible
        });
    } catch (error: any) {
        console.error('Check permission error:', error);
        res.status(500).json({ error: error.message });
    }
};
