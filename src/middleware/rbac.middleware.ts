// File Path = warehouse-backend/src/middleware/rbac.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';

/**
 * Interface for permission check results
 */
interface PermissionResult {
    can_access: boolean;
    is_visible: boolean;
    permission_source: 'user' | 'role' | 'legacy';
}

/**
 * Interface for warehouse access
 */
interface WarehouseAccess {
    warehouse_id: number;
    warehouse_name: string;
    is_default: boolean;
}

/**
 * Cache for permissions (in production, use Redis)
 */
const permissionCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 60000; // 1 minute

// Track if RBAC tables exist
let rbacTablesExist: boolean | null = null;
let warehouseTablesExist: boolean | null = null;

/**
 * Check if RBAC tables exist in the database
 * NOTE: We're using simplified UI access system now, so this always returns false
 * to use legacy role-based access for API permissions
 */
async function checkRbacTablesExist(): Promise<boolean> {
    // Always use legacy mode - the new simplified RBAC is for UI visibility only
    // API access is controlled by role (admin, super_admin get all, others get basic)
    return false;
}

/**
 * Check if user_warehouses table exists (separate from full RBAC)
 */
async function checkWarehouseTablesExist(): Promise<boolean> {
    if (warehouseTablesExist !== null) {
        return warehouseTablesExist;
    }

    try {
        await query(`SELECT 1 FROM user_warehouses LIMIT 1`);
        warehouseTablesExist = true;
    } catch (error) {
        console.log('user_warehouses table not found - using legacy warehouse access');
        warehouseTablesExist = false;
    }
    return warehouseTablesExist;
}

/**
 * Get cached or fetch fresh permissions
 */
async function getCachedPermissions(userId: number, role: string): Promise<Map<string, PermissionResult>> {
    const cacheKey = `perms_${userId}`;
    const cached = permissionCache.get(cacheKey);

    if (cached && cached.expiry > Date.now()) {
        return cached.data;
    }

    // Check if RBAC tables exist
    const tablesExist = await checkRbacTablesExist();

    if (!tablesExist) {
        // Legacy mode: ALL authenticated users get basic permissions
        // UI visibility is controlled by the simplified UI access system
        const permissions = new Map<string, PermissionResult>();
        permissions.set('__legacy_user__', {
            can_access: true,
            is_visible: true,
            permission_source: 'legacy'
        });
        permissionCache.set(cacheKey, { data: permissions, expiry: Date.now() + CACHE_TTL });
        return permissions;
    }

    const result = await query(`
    SELECT 
      permission_code,
      can_access,
      is_visible,
      permission_source
    FROM effective_user_permissions
    WHERE user_id = $1 AND can_access = true
  `, [userId]);

    const permissions = new Map<string, PermissionResult>();
    for (const row of result.rows) {
        permissions.set(row.permission_code, {
            can_access: row.can_access,
            is_visible: row.is_visible,
            permission_source: row.permission_source
        });
    }

    permissionCache.set(cacheKey, { data: permissions, expiry: Date.now() + CACHE_TTL });
    return permissions;
}

/**
 * Get user's accessible warehouses
 * Now checks user_warehouses table separately from RBAC permission system
 */
async function getUserWarehouses(userId: number, legacyWarehouseId?: number): Promise<WarehouseAccess[]> {
    const cacheKey = `warehouses_${userId}`;
    const cached = permissionCache.get(cacheKey);

    if (cached && cached.expiry > Date.now()) {
        return cached.data;
    }

    // Check if user_warehouses table exists (separate from full RBAC system)
    const tablesExist = await checkWarehouseTablesExist();

    if (tablesExist) {
        // First try to get warehouses from user_warehouses table
        try {
            const result = await query(`
                SELECT DISTINCT
                    uw.warehouse_id,
                    w.name as warehouse_name,
                    uw.is_default
                FROM user_warehouses uw
                JOIN warehouses w ON w.id = uw.warehouse_id
                WHERE uw.user_id = $1 AND w.is_active = true
            `, [userId]);

            if (result.rows.length > 0) {
                const warehouses = result.rows;
                permissionCache.set(cacheKey, { data: warehouses, expiry: Date.now() + CACHE_TTL });
                return warehouses;
            }
            // If no entries in user_warehouses, return empty array (means all access)
            permissionCache.set(cacheKey, { data: [], expiry: Date.now() + CACHE_TTL });
            return [];
        } catch (error) {
            console.log('Error querying user_warehouses, falling back to legacy mode');
        }
    }

    // Legacy mode: use user's warehouse_id from token
    if (legacyWarehouseId) {
        const whResult = await query('SELECT id, name, code FROM warehouses WHERE id = $1 AND is_active = true', [legacyWarehouseId]);
        if (whResult.rows.length > 0) {
            const warehouses = [{
                warehouse_id: whResult.rows[0].id,
                warehouse_name: whResult.rows[0].name,
                is_default: true
            }];
            permissionCache.set(cacheKey, { data: warehouses, expiry: Date.now() + CACHE_TTL });
            return warehouses;
        }
    }
    return [];
}

/**
 * Clear permission cache for a user
 */
export function clearPermissionCache(userId?: number) {
    if (userId) {
        permissionCache.delete(`perms_${userId}`);
        permissionCache.delete(`warehouses_${userId}`);
    } else {
        permissionCache.clear();
    }
    // Reset table existence checks on full cache clear
    if (!userId) {
        rbacTablesExist = null;
        warehouseTablesExist = null;
    }
}

/**
 * Middleware: Check if user has a specific permission
 * Usage: requirePermission('feature:inbound:create')
 */
export const requirePermission = (...permissionCodes: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;

            if (!user) {
                return res.status(401).json({ error: 'Unauthorized: No user context' });
            }

            // Super admin bypasses all permission checks
            if (user.role === 'super_admin') {
                return next();
            }

            // Admin in legacy mode bypasses all permission checks
            if (user.role === 'admin') {
                const tablesExist = await checkRbacTablesExist();
                if (!tablesExist) {
                    return next();
                }
            }

            const permissions = await getCachedPermissions(user.userId, user.role);

            // Legacy mode - allow all authenticated users
            if (permissions.has('__legacy_user__') || permissions.has('__legacy_admin__')) {
                return next();
            }

            // Check if user has ANY of the required permissions
            const hasPermission = permissionCodes.some(code => {
                const perm = permissions.get(code);
                return perm?.can_access === true;
            });

            if (!hasPermission) {
                return res.status(403).json({
                    error: 'Forbidden: Insufficient permissions',
                    required: permissionCodes
                });
            }

            next();
        } catch (error: any) {
            console.error('Permission check error:', error);
            res.status(500).json({ error: 'Permission check failed' });
        }
    };
};

/**
 * Middleware: Check if user has ALL specified permissions
 * Usage: requireAllPermissions('feature:inbound:view', 'feature:inbound:edit')
 */
export const requireAllPermissions = (...permissionCodes: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;

            if (!user) {
                return res.status(401).json({ error: 'Unauthorized: No user context' });
            }

            if (user.role === 'super_admin') {
                return next();
            }

            // Admin in legacy mode bypasses all permission checks
            if (user.role === 'admin') {
                const tablesExist = await checkRbacTablesExist();
                if (!tablesExist) {
                    return next();
                }
            }

            const permissions = await getCachedPermissions(user.userId, user.role);

            // Legacy admin mode - allow all
            if (permissions.has('__legacy_admin__')) {
                return next();
            }

            const missingPermissions = permissionCodes.filter(code => {
                const perm = permissions.get(code);
                return !perm?.can_access;
            });

            if (missingPermissions.length > 0) {
                return res.status(403).json({
                    error: 'Forbidden: Missing required permissions',
                    missing: missingPermissions
                });
            }

            next();
        } catch (error: any) {
            console.error('Permission check error:', error);
            res.status(500).json({ error: 'Permission check failed' });
        }
    };
};

/**
 * Middleware: Ensure user can access the warehouse in the request
 * Checks warehouse_id from body, params, or query
 */
export const requireWarehouseAccess = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;

        if (!user) {
            return res.status(401).json({ error: 'Unauthorized: No user context' });
        }

        // Super admin can access all warehouses
        if (user.role === 'super_admin') {
            return next();
        }

        // Legacy mode - all users can access based on their assigned warehouse
        const tablesExist = await checkRbacTablesExist();
        if (!tablesExist) {
            // In legacy mode, allow access but rely on user's warehouseId
            return next();
        }

        // Get warehouse_id from request (body, params, or query)
        const warehouseId = parseInt(
            req.user?.warehouseId ||  //////////////////////////chnange made here to support req.user.warehouseId//////////////////////
            req.body.warehouse_id ||
            req.params.warehouse_id ||
            req.params.warehouseId ||
            req.query.warehouse_id as string ||
            req.query.warehouseId as string ||
            '0'
        );

        if (!warehouseId) {
            // No warehouse specified - will be filtered later
            return next();
        }

        // Check if user can access this warehouse
        const warehouses = await getUserWarehouses(user.userId, user.warehouseId);
        const canAccess = warehouses.some(w => w.warehouse_id === warehouseId);

        if (!canAccess) {
            return res.status(403).json({
                error: 'Forbidden: You do not have access to this warehouse',
                warehouseId
            });
        }

        next();
    } catch (error: any) {
        console.error('Warehouse access check error:', error);
        res.status(500).json({ error: 'Warehouse access check failed' });
    }
};

/**
 * Middleware: Inject user's accessible warehouse IDs into request
 * Use this to filter queries to only show data from accessible warehouses
 */
export const injectWarehouseFilter = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;

        if (!user) {
            return next();
        }

        // Super admin sees all warehouses
        if (user.role === 'super_admin') {
            (req as any).accessibleWarehouses = null; // null = all warehouses
            (req as any).warehouseFilter = ''; // Empty filter = no restriction
            return next();
        }

        // Admin users can see all warehouses (unless restricted in user_warehouses)
        const warehouses = await getUserWarehouses(user.userId, user.warehouseId);

        // If admin and no warehouse restrictions, allow all
        if (user.role === 'admin' && warehouses.length === 0) {
            (req as any).accessibleWarehouses = null;
            (req as any).warehouseFilter = '';
            return next();
        }

        // Check if user_warehouses table exists
        const warehouseTablesOk = await checkWarehouseTablesExist();

        // If warehouse tables don't exist, use legacy warehouseId from token
        if (!warehouseTablesOk) {
            if (user.warehouseId) {
                (req as any).accessibleWarehouses = [user.warehouseId];
                (req as any).defaultWarehouseId = user.warehouseId;
                (req as any).warehouseFilter = `warehouse_id = ${user.warehouseId}`;
            } else {
                (req as any).accessibleWarehouses = null;
                (req as any).warehouseFilter = '';
            }
            return next();
        }
        const warehouseIds = warehouses.map(w => w.warehouse_id);

        // If no warehouses assigned in user_warehouses table, user can access ALL warehouses
        // This is the intended behavior: no restriction = full access
        if (warehouseIds.length === 0) {
            (req as any).accessibleWarehouses = null; // null = all warehouses
            (req as any).warehouseFilter = ''; // Empty = no restriction
            return next();
        }

        (req as any).accessibleWarehouses = warehouseIds;
        (req as any).defaultWarehouseId = warehouses.find(w => w.is_default)?.warehouse_id || warehouseIds[0];

        // Generate SQL filter clause - only restrict if warehouses are explicitly assigned
        (req as any).warehouseFilter = `warehouse_id IN (${warehouseIds.join(',')})`;

        next();
    } catch (error: any) {
        console.error('Warehouse filter injection error:', error);
        next(); // Continue without filter on error
    }
};

/**
 * Helper: Check single permission for a user
 */
export async function checkPermission(userId: number, permissionCode: string, role: string = ''): Promise<boolean> {
    try {
        const permissions = await getCachedPermissions(userId, role);
        // Legacy mode - allow all
        if (permissions.has('__legacy_user__') || permissions.has('__legacy_admin__')) return true;
        const perm = permissions.get(permissionCode);
        return perm?.can_access === true;
    } catch {
        return false;
    }
}

/**
 * Helper: Check if permission is visible for a user
 */
export async function isPermissionVisible(userId: number, permissionCode: string, role: string = ''): Promise<boolean> {
    try {
        const permissions = await getCachedPermissions(userId, role);
        // Legacy mode - all visible
        if (permissions.has('__legacy_user__') || permissions.has('__legacy_admin__')) return true;
        const perm = permissions.get(permissionCode);
        return perm?.is_visible === true;
    } catch {
        return false;
    }
}

/**
 * Helper: Get all permissions for a user
 */
export async function getAllUserPermissions(userId: number, role: string = ''): Promise<PermissionResult[]> {
    const permissions = await getCachedPermissions(userId, role);
    return Array.from(permissions.entries()).map(([code, perm]) => ({
        permission_code: code,
        ...perm
    })) as any;
}

/**
 * Helper: Get all accessible warehouses for a user
 */
export async function getAccessibleWarehouses(userId: number): Promise<WarehouseAccess[]> {
    return getUserWarehouses(userId);
}

/**
 * Middleware: Check page access
 * Used for protecting entire route groups
 */
export const requirePageAccess = (pageName: string) => {
    return requirePermission(`page:${pageName}`);
};

/**
 * Middleware: Check feature access
 */
export const requireFeatureAccess = (resource: string, action: string) => {
    return requirePermission(`feature:${resource}:${action}`);
};

/**
 * Middleware: Check action access
 */
export const requireActionAccess = (actionCode: string) => {
    return requirePermission(`action:${actionCode}`);
};
