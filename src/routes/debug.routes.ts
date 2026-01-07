// Debug route to check permissions
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { query } from '../config/database';

const router = Router();

router.use(authMiddleware);

// Debug endpoint to check current user's permissions
router.get('/debug-permissions', async (req, res) => {
    try {
        const user = (req as any).user;

        if (!user) {
            return res.status(401).json({ error: 'No user in request' });
        }

        console.log('\n🔍 DEBUG PERMISSIONS CHECK');
        console.log('User:', user);

        // Get all permissions for this role
        const result = await query(
            'SELECT permission_key, enabled FROM role_permissions WHERE role = $1 ORDER BY permission_key',
            [user.role]
        );

        const enabledPermissions = result.rows.filter((r: any) => r.enabled);
        const disabledPermissions = result.rows.filter((r: any) => !r.enabled);

        const response = {
            user: {
                userId: user.userId,
                username: user.username,
                role: user.role,
                warehouseId: user.warehouseId
            },
            totalPermissions: result.rows.length,
            enabledCount: enabledPermissions.length,
            disabledCount: disabledPermissions.length,
            enabledPermissions: enabledPermissions.map((r: any) => r.permission_key),
            disabledPermissions: disabledPermissions.map((r: any) => r.permission_key),
            allPermissions: result.rows.map((r: any) => ({
                key: r.permission_key,
                enabled: r.enabled
            }))
        };

        console.log('Response:', JSON.stringify(response, null, 2));

        res.json(response);
    } catch (error: any) {
        console.error('Debug permissions error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
