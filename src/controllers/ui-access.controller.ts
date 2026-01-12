// File Path = warehouse-backend/src/controllers/ui-access.controller.ts
import { Request, Response } from 'express';
import { query } from '../config/database';

/**
 * Get all UI elements grouped by type
 */
export const getAllElements = async (req: Request, res: Response) => {
    try {
        const result = await query(`
            SELECT code, name, element_type, parent_menu, sort_order, is_active
            FROM ui_elements
            ORDER BY sort_order
        `);

        // Group by type
        const grouped = {
            menus: result.rows.filter(r => r.element_type === 'menu'),
            tabs: result.rows.filter(r => r.element_type === 'tab'),
            buttons: result.rows.filter(r => r.element_type === 'button'),
        };

        res.json(grouped);
    } catch (error: any) {
        console.error('Get UI elements error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get current user's UI access
 */
export const getMyAccess = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;

        // Super admin gets everything
        if (user.role === 'super_admin' || user.role === 'admin') {
            const elements = await query(`
                SELECT code, name, element_type, parent_menu
                FROM ui_elements
                WHERE is_active = true
                ORDER BY sort_order
            `);

            const access: Record<string, boolean> = {};
            elements.rows.forEach(e => {
                access[e.code] = true;
            });

            return res.json({
                access,
                elements: elements.rows,
                role: user.role
            });
        }

        // Regular users - check role_ui_access and overrides
        const result = await query(`
            SELECT 
                e.code,
                e.name,
                e.element_type,
                e.parent_menu,
                COALESCE(uuo.is_visible, rua.is_visible, false) as is_visible
            FROM ui_elements e
            LEFT JOIN roles r ON r.name = $2
            LEFT JOIN role_ui_access rua ON rua.role_id = r.id AND rua.element_code = e.code
            LEFT JOIN user_ui_overrides uuo ON uuo.user_id = $1 AND uuo.element_code = e.code
            WHERE e.is_active = true
            ORDER BY e.sort_order
        `, [user.userId, user.role]);

        const access: Record<string, boolean> = {};
        result.rows.forEach(e => {
            access[e.code] = e.is_visible === true;
        });

        res.json({
            access,
            elements: result.rows,
            role: user.role
        });
    } catch (error: any) {
        console.error('Get my access error:', error);
        // Fallback - return all access for admin roles
        const user = (req as any).user;
        if (user.role === 'super_admin' || user.role === 'admin') {
            return res.json({ access: {}, elements: [], role: user.role, legacy: true });
        }
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all roles
 */
export const getRoles = async (req: Request, res: Response) => {
    try {
        const result = await query(`
            SELECT 
                r.id, r.name, r.description, r.is_system_role, r.is_active, r.priority,
                COUNT(DISTINCT rua.id) as element_count,
                COUNT(DISTINCT u.id) as user_count
            FROM roles r
            LEFT JOIN role_ui_access rua ON rua.role_id = r.id AND rua.is_visible = true
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

/**
 * Get UI access for a specific role
 */
export const getRoleAccess = async (req: Request, res: Response) => {
    try {
        const { roleId } = req.params;

        const result = await query(`
            SELECT 
                e.code,
                e.name,
                e.element_type,
                e.parent_menu,
                COALESCE(rua.is_visible, false) as is_visible
            FROM ui_elements e
            LEFT JOIN role_ui_access rua ON rua.role_id = $1 AND rua.element_code = e.code
            WHERE e.is_active = true
            ORDER BY e.element_type, e.sort_order
        `, [roleId]);

        res.json(result.rows);
    } catch (error: any) {
        console.error('Get role access error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update role UI access
 */
export const updateRoleAccess = async (req: Request, res: Response) => {
    try {
        const { roleId } = req.params;
        const { elements } = req.body; // Array of { code, is_visible }

        if (!Array.isArray(elements)) {
            return res.status(400).json({ error: 'Elements array required' });
        }

        // Start transaction
        await query('BEGIN');

        for (const el of elements) {
            await query(`
                INSERT INTO role_ui_access (role_id, element_code, is_visible)
                VALUES ($1, $2, $3)
                ON CONFLICT (role_id, element_code) 
                DO UPDATE SET is_visible = $3, updated_at = NOW()
            `, [roleId, el.code, el.is_visible]);
        }

        await query('COMMIT');

        res.json({ success: true, message: 'Role access updated' });
    } catch (error: any) {
        await query('ROLLBACK');
        console.error('Update role access error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get UI access overrides for a specific user
 */
export const getUserOverrides = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        // Get user's role first
        const userResult = await query('SELECT role FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const userRole = userResult.rows[0].role;

        // Get role ID
        const roleResult = await query('SELECT id FROM roles WHERE name = $1', [userRole]);
        const roleId = roleResult.rows[0]?.id;

        const result = await query(`
            SELECT 
                e.code,
                e.name,
                e.element_type,
                e.parent_menu,
                COALESCE(rua.is_visible, false) as role_default,
                uuo.is_visible as user_override,
                COALESCE(uuo.is_visible, rua.is_visible, false) as effective
            FROM ui_elements e
            LEFT JOIN role_ui_access rua ON rua.role_id = $2 AND rua.element_code = e.code
            LEFT JOIN user_ui_overrides uuo ON uuo.user_id = $1 AND uuo.element_code = e.code
            WHERE e.is_active = true
            ORDER BY e.element_type, e.sort_order
        `, [userId, roleId]);

        res.json({
            userRole,
            elements: result.rows
        });
    } catch (error: any) {
        console.error('Get user overrides error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update user UI overrides
 */
export const updateUserOverrides = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { overrides } = req.body; // Array of { code, is_visible } - only elements that differ from role

        if (!Array.isArray(overrides)) {
            return res.status(400).json({ error: 'Overrides array required' });
        }

        await query('BEGIN');

        // Clear existing overrides
        await query('DELETE FROM user_ui_overrides WHERE user_id = $1', [userId]);

        // Insert new overrides
        for (const override of overrides) {
            if (override.is_visible !== null && override.is_visible !== undefined) {
                await query(`
                    INSERT INTO user_ui_overrides (user_id, element_code, is_visible)
                    VALUES ($1, $2, $3)
                `, [userId, override.code, override.is_visible]);
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

/**
 * Get user warehouses
 */
export const getUserWarehouses = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        const result = await query(`
            SELECT 
                w.id as warehouse_id,
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

/**
 * Update user warehouses
 */
export const updateUserWarehouses = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { warehouse_ids, default_warehouse_id } = req.body;

        if (!Array.isArray(warehouse_ids)) {
            return res.status(400).json({ error: 'warehouse_ids array required' });
        }

        await query('BEGIN');

        // Clear existing
        await query('DELETE FROM user_warehouses WHERE user_id = $1', [userId]);

        // Insert new
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

/**
 * Create a new role
 */
export const createRole = async (req: Request, res: Response) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Role name required' });
        }

        const result = await query(`
            INSERT INTO roles (name, description, is_system_role, is_active, priority)
            VALUES ($1, $2, false, true, 20)
            RETURNING *
        `, [name.toLowerCase().replace(/\s+/g, '_'), description || '']);

        res.json(result.rows[0]);
    } catch (error: any) {
        console.error('Create role error:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Role already exists' });
        }
        res.status(500).json({ error: error.message });
    }
};

/**
 * Delete a role
 */
export const deleteRole = async (req: Request, res: Response) => {
    try {
        const { roleId } = req.params;

        // Check if system role
        const check = await query('SELECT is_system_role FROM roles WHERE id = $1', [roleId]);
        if (check.rows[0]?.is_system_role) {
            return res.status(400).json({ error: 'Cannot delete system role' });
        }

        await query('DELETE FROM roles WHERE id = $1', [roleId]);

        res.json({ success: true, message: 'Role deleted' });
    } catch (error: any) {
        console.error('Delete role error:', error);
        res.status(500).json({ error: error.message });
    }
};
