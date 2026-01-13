// File Path = warehouse-backend/src/routes/error-logs.routes.ts
import express, { Router } from 'express';
import { authMiddleware, hasRole } from '../middleware/auth.middleware';
import { query } from '../config/database';

const router: Router = express.Router();

// All routes require super_admin only
router.use(authMiddleware);
router.use(hasRole('super_admin'));

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
