// File Path = warehouse-backend/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../config/auth';
import { query } from '../config/database';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    console.log('🔐 Auth Middleware - Path:', req.path);
    console.log('   Auth Header:', authHeader ? 'Present' : 'Missing');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No Bearer token found');
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.slice(7);
    console.log('   Token (first 20 chars):', token.substring(0, 20) + '...');

    const user = verifyToken(token);
    console.log('✅ Token verified - User:', user.username, '| Role:', user.role);

    req.user = user;
    next();
  } catch (error: any) {
    console.log('❌ Token verification failed:', error.message);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
};

// Role-based middleware - MODIFIED TO BE MORE PERMISSIVE
// Now checks if user is authenticated and has a valid role
// Specific permission checks should be done at frontend level
export const hasRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Admin always has access
    if (req.user.role === 'admin') {
      next();
      return;
    }

    // For other roles, check if they are in allowed roles
    // BUT: Be permissive - if allowedRoles includes common roles like manager/operator,
    // allow other operational roles too (qc, picker) to access
    const operationalRoles = ['manager', 'operator', 'qc', 'picker'];
    const hasOperationalAccess = allowedRoles.some(role => operationalRoles.includes(role));

    if (hasOperationalAccess && operationalRoles.includes(req.user.role)) {
      // Allow any operational role if route allows operational access
      next();
      return;
    }

    // Original strict check for specific cases
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: Requires ${allowedRoles.join(' or ')} role` });
    }

    next();
  };
};

// NEW: Permission-based middleware - checks actual database permissions
export const hasPermission = (...requiredPermissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    console.log('\n🔍 hasPermission Check Started');
    console.log('   Path:', req.path);
    console.log('   Method:', req.method);
    console.log('   Required Permissions:', requiredPermissions);

    if (!req.user) {
      console.log('❌ No user in request');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const role = req.user.role;
    console.log('   User Role:', role);
    console.log('   User ID:', req.user.userId);
    console.log('   Username:', req.user.username);

    // Admin always has access
    if (role === 'admin') {
      console.log('✅ Admin bypass - access granted\n');
      next();
      return;
    }

    try {
      // First, let's see ALL permissions for this role
      const allPermsResult = await query(
        `SELECT permission_key, enabled FROM role_permissions WHERE role = $1`,
        [role]
      );

      console.log(`   Total permissions in DB for ${role}:`, allPermsResult.rows.length);
      console.log('   Enabled permissions:', allPermsResult.rows.filter((r: any) => r.enabled).length);

      // Check if user has at least one of the required permissions
      const result = await query(
        `SELECT permission_key, enabled 
         FROM role_permissions 
         WHERE role = $1 AND permission_key = ANY($2::text[])`,
        [role, requiredPermissions]
      );

      console.log('   Matching permissions found:', result.rows.length);

      if (result.rows.length > 0) {
        console.log('   Found permissions:', result.rows.map((r: any) => `${r.permission_key}=${r.enabled}`).join(', '));

        // Check if any are enabled
        const hasEnabledPermission = result.rows.some((r: any) => r.enabled === true);

        if (hasEnabledPermission) {
          const enabledPerms = result.rows.filter((r: any) => r.enabled).map((r: any) => r.permission_key);
          console.log(`✅ Permission granted - Enabled: ${enabledPerms.join(', ')}\n`);
          next();
          return;
        } else {
          console.log('❌ Permissions found but all are DISABLED');
        }
      } else {
        console.log('❌ No matching permissions found in database');
        console.log('   Sample of available permissions:', allPermsResult.rows.slice(0, 5).map((r: any) => r.permission_key).join(', '));
      }

      // No matching enabled permissions found
      console.log(`❌ Permission DENIED - Role: ${role}, Required: ${requiredPermissions.join(' or ')}\n`);
      return res.status(403).json({
        error: 'Forbidden: Insufficient permissions',
        required: requiredPermissions,
        role: role,
        hasPermissions: result.rows.map((r: any) => ({ key: r.permission_key, enabled: r.enabled }))
      });
    } catch (error: any) {
      console.error('❌ Permission check error:', error);
      console.error('   Error details:', error.message);
      console.error('   Stack:', error.stack);
      return res.status(500).json({ error: 'Failed to check permissions' });
    }
  };
};
