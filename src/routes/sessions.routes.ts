// File Path = warehouse-backend/src/routes/sessions.routes.ts
import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authMiddleware, hasRole } from '../middleware/auth.middleware';
import crypto from 'crypto';
import logger from '../utils/logger';

const router = Router();

// Helper to hash token
const hashToken = (token: string): string => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

// Get all active sessions (super_admin and admin only)
router.get('/', authMiddleware, hasRole('super_admin', 'admin'), async (req: Request, res: Response) => {
    try {
        const result = await query(`
      SELECT 
        s.id,
        s.user_id,
        u.username,
        u.full_name,
        u.role,
        s.ip_address,
        s.user_agent,
        s.created_at as logged_in_at,
        s.expires_at
      FROM active_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.is_active = true AND s.expires_at > NOW()
      ORDER BY s.created_at DESC
    `);

        res.json({ sessions: result.rows });
    } catch (error: any) {
        logger.error('Error fetching sessions', error);
        res.status(500).json({ error: 'Failed to fetch active sessions' });
    }
});

// Get online users count
router.get('/online-count', authMiddleware, hasRole('super_admin', 'admin'), async (req: Request, res: Response) => {
    try {
        const result = await query(`
      SELECT COUNT(DISTINCT user_id) as count 
      FROM active_sessions 
      WHERE is_active = true AND expires_at > NOW()
    `);

        res.json({ count: parseInt(result.rows[0].count) || 0 });
    } catch (error: any) {
        logger.error('Error fetching online count', error);
        res.status(500).json({ error: 'Failed to fetch online count' });
    }
});

// Get online user IDs (for frontend to show status)
router.get('/online-users', authMiddleware, hasRole('super_admin', 'admin'), async (req: Request, res: Response) => {
    try {
        const result = await query(`
      SELECT DISTINCT user_id 
      FROM active_sessions 
      WHERE is_active = true AND expires_at > NOW()
    `);

        res.json({ userIds: result.rows.map((r: { user_id: number }) => r.user_id) });
    } catch (error: any) {
        logger.error('Error fetching online users', error);
        res.status(500).json({ error: 'Failed to fetch online users' });
    }
});

// Logout specific user (invalidate all their sessions)
router.post('/logout-user/:userId', authMiddleware, hasRole('super_admin', 'admin'), async (req: Request, res: Response) => {
    try {
        const targetUserId = parseInt(req.params.userId);
        const currentUser = req.user!;

        // Get target user info
        const targetResult = await query('SELECT id, role, username FROM users WHERE id = $1', [targetUserId]);
        if (targetResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const targetUser = targetResult.rows[0];

        // Can't logout yourself
        if (targetUserId === currentUser.userId) {
            return res.status(400).json({ error: 'Cannot logout yourself from here. Use normal logout.' });
        }

        // Admin can only logout regular users (not other admins or super_admin)
        if (currentUser.role === 'admin') {
            if (targetUser.role === 'admin' || targetUser.role === 'super_admin') {
                return res.status(403).json({ error: 'Admins can only logout regular users, not other admins' });
            }
        }

        // Super admin can logout anyone except themselves (already checked above)

        // Invalidate all sessions for target user
        const result = await query(`
      UPDATE active_sessions 
      SET is_active = false 
      WHERE user_id = $1 AND is_active = true
      RETURNING id
    `, [targetUserId]);

        logger.info(`User ${currentUser.username} logged out user ${targetUser.username} (${result.rowCount} sessions)`);

        res.json({
            message: `User ${targetUser.username} has been logged out`,
            sessionsInvalidated: result.rowCount
        });
    } catch (error: any) {
        logger.error('Error logging out user', error);
        res.status(500).json({ error: 'Failed to logout user' });
    }
});

// Logout all users (super_admin only)
router.post('/logout-all', authMiddleware, hasRole('super_admin'), async (req: Request, res: Response) => {
    try {
        const currentUser = req.user!;
        const { excludeSelf } = req.body;

        let result;
        if (excludeSelf) {
            // Logout all except current user
            result = await query(`
        UPDATE active_sessions 
        SET is_active = false 
        WHERE is_active = true AND user_id != $1
        RETURNING id
      `, [currentUser.userId]);
        } else {
            // Logout everyone including self
            result = await query(`
        UPDATE active_sessions 
        SET is_active = false 
        WHERE is_active = true
        RETURNING id
      `);
        }

        logger.info(`Super admin ${currentUser.username} logged out all users (${result.rowCount} sessions)`);

        res.json({
            message: `All users have been logged out`,
            sessionsInvalidated: result.rowCount
        });
    } catch (error: any) {
        logger.error('Error logging out all users', error);
        res.status(500).json({ error: 'Failed to logout all users' });
    }
});

// Cleanup expired sessions (can be called periodically)
router.delete('/cleanup', authMiddleware, hasRole('super_admin'), async (req: Request, res: Response) => {
    try {
        const result = await query(`
      DELETE FROM active_sessions 
      WHERE expires_at < NOW() OR is_active = false
      RETURNING id
    `);

        res.json({
            message: 'Expired sessions cleaned up',
            deletedCount: result.rowCount
        });
    } catch (error: any) {
        logger.error('Error cleaning up sessions', error);
        res.status(500).json({ error: 'Failed to cleanup sessions' });
    }
});

export default router;
export { hashToken };
