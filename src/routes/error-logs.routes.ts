// File Path = warehouse-backend/src/routes/error-logs.routes.ts
import express, { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { query } from '../config/database';

const router: Router = express.Router();

// Middleware to check if user can access error logs (admin, super_admin, or users with permission)
const canAccessErrorLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user;
        console.log('[ErrorLogs] User check:', JSON.stringify(user));

        if (!user) {
            console.log('[ErrorLogs] No user found');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Super admin and admin always have access (case-insensitive check)
        const role = (user.role || '').toLowerCase();
        if (role === 'super_admin' || role === 'admin') {
            console.log('[ErrorLogs] Admin/Super admin access granted for role:', user.role);
            return next();
        }

        // For other users, check if they have the menu permission
        const permResult = await query(
            `SELECT 1 FROM permissions p
             JOIN role_permissions rp ON p.id = rp.permission_id
             JOIN roles r ON r.id = rp.role_id
             JOIN users u ON u.role = r.name
             WHERE u.id = $1 
             AND p.code = 'menu:settings:errorlogs'
             AND rp.is_visible = true
             LIMIT 1`,
            [user.userId]
        );

        if (permResult.rows.length > 0) {
            console.log('[ErrorLogs] Role permission granted');
            return next();
        }

        // Also check user permission overrides
        const overrideResult = await query(
            `SELECT 1 FROM permissions p
             JOIN user_permission_overrides upo ON p.id = upo.permission_id
             WHERE upo.user_id = $1 
             AND p.code = 'menu:settings:errorlogs'
             AND upo.is_visible = true
             LIMIT 1`,
            [user.userId]
        );

        if (overrideResult.rows.length > 0) {
            console.log('[ErrorLogs] User override permission granted');
            return next();
        }

        console.log('[ErrorLogs] Access denied for user:', user.username, 'role:', user.role);
        return res.status(403).json({ error: 'Access denied: You do not have permission to view error logs' });
    } catch (error) {
        console.error('Error checking error logs permission:', error);
        return res.status(500).json({ error: 'Failed to check permissions' });
    }
};

// All routes require authentication
router.use(authMiddleware);
router.use(canAccessErrorLogs);

// Get recent error logs (last 100)
router.get('/', async (req, res) => {
    try {
        const result = await query(
            `SELECT id, message, endpoint, method, username, stack_trace, created_at 
             FROM error_logs 
             ORDER BY created_at DESC 
             LIMIT 100`
        );
        res.json({ logs: result.rows });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// Get log count
router.get('/count', async (req, res) => {
    try {
        const result = await query('SELECT COUNT(*) as count FROM error_logs');
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to get count' });
    }
});

// Clear all logs
router.delete('/clear', async (req, res) => {
    try {
        await query('DELETE FROM error_logs');
        res.json({ message: 'All logs cleared' });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to clear logs' });
    }
});

// Delete logs older than X days
router.delete('/cleanup/:days', async (req, res) => {
    try {
        const days = parseInt(req.params.days) || 7;
        const result = await query(
            `DELETE FROM error_logs WHERE created_at < NOW() - INTERVAL '1 day' * $1 RETURNING id`,
            [days]
        );
        res.json({ deleted: result.rowCount || 0 });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to cleanup logs' });
    }
});

export default router;
