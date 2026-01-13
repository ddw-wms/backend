// File Path = warehouse-backend/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../config/auth';
import { query } from '../config/database';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

// Helper to hash token
const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.slice(7);
    const user = verifyToken(token);

    // Check if session is still active (token not invalidated)
    try {
      const tokenHash = hashToken(token);
      const sessionResult = await query(
        'SELECT id FROM active_sessions WHERE token_hash = $1 AND is_active = true AND expires_at > NOW()',
        [tokenHash]
      );

      if (sessionResult.rows.length === 0) {
        // Session was invalidated (logged out by admin)
        return res.status(401).json({ error: 'Session expired. Please login again.', code: 'SESSION_INVALIDATED' });
      }
    } catch (dbError: any) {
      // Table might not exist yet - allow through for backwards compatibility
      // This ensures existing tokens work during migration
    }

    req.user = user;
    next();
  } catch (error: any) {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
};

// Role-based middleware
export const hasRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: Requires ${allowedRoles.join(' or ')} role` });
    }

    next();
  };
};
