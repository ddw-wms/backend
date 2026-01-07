// File Path = wms_backend/src/controllers/permissions.controller.ts
import { Request, Response } from 'express';
import { query, getPool } from '../config/database';

// Get all available permissions
export const getAllPermissions = async (req: Request, res: Response) => {
    try {
        const result = await query(
            `SELECT * FROM permissions ORDER BY category, permission_name`
        );
        res.json(result.rows);
    } catch (error: any) {
        console.error('Error fetching permissions:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get permissions grouped by category
export const getPermissionsByCategory = async (req: Request, res: Response) => {
    try {
        const result = await query(
            `SELECT 
        category,
        json_agg(
          json_build_object(
            'id', id,
            'permission_key', permission_key,
            'permission_name', permission_name,
            'description', description
          ) ORDER BY permission_name
        ) as permissions
      FROM permissions
      GROUP BY category
      ORDER BY category`
        );
        res.json(result.rows);
    } catch (error: any) {
        console.error('Error fetching permissions by category:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get role permissions (all permissions with enabled status for a role)
export const getRolePermissions = async (req: Request, res: Response) => {
    try {
        const { role } = req.params;

        const result = await query(
            `SELECT 
        p.id,
        p.permission_key,
        p.permission_name,
        p.category,
        p.description,
        COALESCE(rp.enabled, false) as enabled,
        COALESCE(rp.id, 0) as role_permission_id
      FROM permissions p
      LEFT JOIN role_permissions rp ON p.permission_key = rp.permission_key AND rp.role = $1
      ORDER BY p.category, p.permission_name`,
            [role]
        );

        res.json(result.rows);
    } catch (error: any) {
        console.error('Error fetching role permissions:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get all roles with their permission counts
export const getRolesWithPermissions = async (req: Request, res: Response) => {
    try {
        const roles = ['admin', 'manager', 'operator', 'qc', 'picker'];

        const result = await query(
            `SELECT 
        role,
        COUNT(*) FILTER (WHERE enabled = true) as enabled_count,
        COUNT(*) as total_count
      FROM role_permissions
      WHERE role = ANY($1::text[])
      GROUP BY role`,
            [roles]
        );

        // Add roles that don't have any permissions yet
        const existingRoles = result.rows.map((r: any) => r.role);
        const missingRoles = roles.filter(r => !existingRoles.includes(r));

        const allRoles = [
            ...result.rows,
            ...missingRoles.map(role => ({ role, enabled_count: 0, total_count: 0 }))
        ];

        res.json(allRoles);
    } catch (error: any) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update role permission (enable/disable)
export const updateRolePermission = async (req: Request, res: Response) => {
    try {
        const { role, permissionKey } = req.params;
        const { enabled } = req.body;

        // Check if permission exists
        const permCheck = await query(
            'SELECT id FROM permissions WHERE permission_key = $1',
            [permissionKey]
        );

        if (permCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Permission not found' });
        }

        // Upsert role permission
        const result = await query(
            `INSERT INTO role_permissions (role, permission_key, enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (role, permission_key)
       DO UPDATE SET enabled = $3, updated_at = NOW()
       RETURNING *`,
            [role, permissionKey, enabled]
        );

        res.json(result.rows[0]);
    } catch (error: any) {
        console.error('Error updating role permission:', error);
        res.status(500).json({ error: error.message });
    }
};

// Bulk update role permissions
export const bulkUpdateRolePermissions = async (req: Request, res: Response) => {
    try {
        const { role } = req.params;
        const { permissions } = req.body; // Array of { permission_key, enabled }

        if (!Array.isArray(permissions)) {
            return res.status(400).json({ error: 'Permissions must be an array' });
        }

        console.log(`📝 Bulk updating ${permissions.length} permissions for role: ${role}`);

        const pool = getPool();
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Optimized: Use single query with unnest arrays instead of loop
            const permissionKeys = permissions.map(p => p.permission_key);
            const enabledValues = permissions.map(p => p.enabled);

            await client.query(
                `INSERT INTO role_permissions (role, permission_key, enabled)
                 SELECT $1, unnest($2::text[]), unnest($3::boolean[])
                 ON CONFLICT (role, permission_key)
                 DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()`,
                [role, permissionKeys, enabledValues]
            );

            await client.query('COMMIT');
            console.log(`✅ Successfully updated ${permissions.length} permissions for ${role}`);
            res.json({ message: 'Permissions updated successfully', count: permissions.length });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Transaction rolled back:', error);
            throw error;
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('Error bulk updating permissions:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get user-specific permissions (overrides)
export const getUserPermissions = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        const result = await query(
            `SELECT 
        p.id,
        p.permission_key,
        p.permission_name,
        p.category,
        p.description,
        up.enabled,
        up.id as user_permission_id
      FROM user_permissions up
      JOIN permissions p ON up.permission_key = p.permission_key
      WHERE up.user_id = $1
      ORDER BY p.category, p.permission_name`,
            [userId]
        );

        res.json(result.rows);
    } catch (error: any) {
        console.error('Error fetching user permissions:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get effective permissions for a user (combines role and user-specific permissions)
export const getEffectiveUserPermissions = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        // Get user's role
        const userResult = await query(
            'SELECT role FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userRole = userResult.rows[0].role;

        // Get all permissions with effective status
        const result = await query(
            `SELECT 
        p.id,
        p.permission_key,
        p.permission_name,
        p.category,
        p.description,
        COALESCE(up.enabled, rp.enabled, false) as enabled,
        CASE 
          WHEN up.id IS NOT NULL THEN 'user'
          WHEN rp.id IS NOT NULL THEN 'role'
          ELSE 'default'
        END as source
      FROM permissions p
      LEFT JOIN role_permissions rp ON p.permission_key = rp.permission_key AND rp.role = $1
      LEFT JOIN user_permissions up ON p.permission_key = up.permission_key AND up.user_id = $2
      ORDER BY p.category, p.permission_name`,
            [userRole, userId]
        );

        res.json({
            userId: parseInt(userId),
            role: userRole,
            permissions: result.rows
        });
    } catch (error: any) {
        console.error('Error fetching effective user permissions:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update user-specific permission
export const updateUserPermission = async (req: Request, res: Response) => {
    try {
        const { userId, permissionKey } = req.params;
        const { enabled } = req.body;

        // Check if user exists
        const userCheck = await query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if permission exists
        const permCheck = await query(
            'SELECT id FROM permissions WHERE permission_key = $1',
            [permissionKey]
        );
        if (permCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Permission not found' });
        }

        // Upsert user permission
        const result = await query(
            `INSERT INTO user_permissions (user_id, permission_key, enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, permission_key)
       DO UPDATE SET enabled = $3, updated_at = NOW()
       RETURNING *`,
            [userId, permissionKey, enabled]
        );

        res.json(result.rows[0]);
    } catch (error: any) {
        console.error('Error updating user permission:', error);
        res.status(500).json({ error: error.message });
    }
};

// Delete user-specific permission (revert to role default)
export const deleteUserPermission = async (req: Request, res: Response) => {
    try {
        const { userId, permissionKey } = req.params;

        const result = await query(
            'DELETE FROM user_permissions WHERE user_id = $1 AND permission_key = $2 RETURNING *',
            [userId, permissionKey]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User permission not found' });
        }

        res.json({ message: 'User permission deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting user permission:', error);
        res.status(500).json({ error: error.message });
    }
};

// Reset all permissions for a role to defaults
export const resetRolePermissions = async (req: Request, res: Response) => {
    try {
        const { role } = req.params;

        // Delete existing role permissions
        await query('DELETE FROM role_permissions WHERE role = $1', [role]);

        // Re-insert default permissions based on role
        let defaultPermissions: string[] = [];

        switch (role) {
            case 'admin':
                // Admin gets all permissions
                const allPerms = await query('SELECT permission_key FROM permissions');
                defaultPermissions = allPerms.rows.map((r: any) => r.permission_key);
                break;

            case 'manager':
                const managerPerms = await query(
                    `SELECT permission_key FROM permissions 
           WHERE category IN ('dashboard', 'inbound', 'outbound', 'inventory', 'picking', 'qc', 'reports', 'customers', 'master-data', 'warehouses', 'racks')`
                );
                defaultPermissions = managerPerms.rows.map((r: any) => r.permission_key);
                break;

            case 'operator':
                defaultPermissions = [
                    'view_dashboard', 'view_dashboard_stats',
                    'view_inbound', 'receive_inbound',
                    'view_outbound', 'dispatch_outbound',
                    'view_inventory',
                    'view_picking', 'complete_picking',
                    'view_customers',
                    'print_labels'
                ];
                break;

            case 'qc':
                defaultPermissions = [
                    'view_dashboard', 'view_dashboard_stats',
                    'view_qc', 'create_qc', 'edit_qc', 'approve_qc', 'reject_qc', 'export_qc',
                    'view_inventory',
                    'view_inbound',
                    'print_labels'
                ];
                break;

            case 'picker':
                defaultPermissions = [
                    'view_dashboard', 'view_dashboard_stats',
                    'view_picking', 'complete_picking',
                    'view_inventory',
                    'view_outbound',
                    'print_labels'
                ];
                break;
        }

        // Insert default permissions
        for (const permKey of defaultPermissions) {
            await query(
                `INSERT INTO role_permissions (role, permission_key, enabled)
         VALUES ($1, $2, true)
         ON CONFLICT (role, permission_key) DO NOTHING`,
                [role, permKey]
            );
        }

        res.json({
            message: 'Role permissions reset to defaults',
            role,
            permissionsCount: defaultPermissions.length
        });
    } catch (error: any) {
        console.error('Error resetting role permissions:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get permission check result for current user
export const checkMyPermissions = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const userRole = req.user?.role;

        if (!userId || !userRole) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Get all permissions with effective status
        const result = await query(
            `SELECT 
        p.permission_key,
        p.category,
        COALESCE(up.enabled, rp.enabled, false) as enabled
      FROM permissions p
      LEFT JOIN role_permissions rp ON p.permission_key = rp.permission_key AND rp.role = $1
      LEFT JOIN user_permissions up ON p.permission_key = up.permission_key AND up.user_id = $2
      ORDER BY p.category, p.permission_key`,
            [userRole, userId]
        );

        // Convert to object format for easier lookup
        const permissions: Record<string, boolean> = {};
        result.rows.forEach((row: any) => {
            permissions[row.permission_key] = row.enabled;
        });

        res.json({
            userId,
            role: userRole,
            permissions
        });
    } catch (error: any) {
        console.error('Error checking user permissions:', error);
        res.status(500).json({ error: error.message });
    }
};
