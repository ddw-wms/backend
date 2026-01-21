// File Path = warehouse-backend/src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { query } from '../config/database';
import { generateToken } from '../config/auth';
import { hashPassword, comparePasswords } from '../utils/helpers';
import { validateEmail, validatePassword, validateUsername } from '../utils/validators';
import logger from '../utils/logger';
import crypto from 'crypto';

// Helper to hash token for storage
const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // ⚡ EGRESS OPTIMIZATION: Select only needed columns instead of SELECT *
    const result = await query(
      `SELECT id, username, password_hash, full_name, email, role, warehouse_id, 
              is_active, created_at, last_login 
       FROM users WHERE username = $1 AND is_active = true`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValidPassword = await comparePasswords(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Build permission map - handle case when RBAC tables don't exist
    let permissions: Record<string, { can_access: boolean; is_visible: boolean }> = {};
    let warehousesList: any[] = [];

    // Try to fetch user permissions from RBAC system
    try {
      const permissionsResult = await query(`
        SELECT 
          permission_code, can_access, is_visible
        FROM effective_user_permissions
        WHERE user_id = $1 AND can_access = true
      `, [user.id]);

      for (const p of permissionsResult.rows) {
        permissions[p.permission_code] = {
          can_access: p.can_access,
          is_visible: p.is_visible
        };
      }
    } catch (permError: any) {
      // Permissions tables don't exist - use legacy role-based access
      logger.debug('Permission tables not found, using legacy role-based access');
      if (user.role === 'admin' || user.role === 'super_admin') {
        permissions = { '__legacy_admin__': { can_access: true, is_visible: true } };
      }
    }

    // Fetch accessible warehouses - SEPARATE from permissions
    try {
      // First try user_warehouses table directly (more reliable than view)
      const warehousesResult = await query(`
        SELECT DISTINCT
          uw.warehouse_id, 
          w.name as warehouse_name, 
          w.code as warehouse_code, 
          uw.is_default
        FROM user_warehouses uw
        JOIN warehouses w ON w.id = uw.warehouse_id
        WHERE uw.user_id = $1 AND w.is_active = true
      `, [user.id]);

      warehousesList = warehousesResult.rows;

      // If user has warehouse restrictions, use them
      // If empty, user has access to ALL warehouses (no restriction)
      logger.debug('User warehouse access', { username: user.username, warehouses: warehousesList.length > 0 ? warehousesList.map(w => w.warehouse_name).join(', ') : 'ALL (no restrictions)' });
    } catch (whError: any) {
      logger.debug('user_warehouses table not found, using legacy warehouse_id');
      // Fallback to legacy warehouse_id
      if (user.warehouse_id) {
        const whResult = await query('SELECT id, name, code FROM warehouses WHERE id = $1', [user.warehouse_id]);
        if (whResult.rows.length > 0) {
          warehousesList = [{
            warehouse_id: whResult.rows[0].id,
            warehouse_name: whResult.rows[0].name,
            warehouse_code: whResult.rows[0].code,
            is_default: true
          }];
        }
      }
    }

    const token = generateToken({
      userId: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      warehouseId: user.warehouse_id,
    });

    // Create active session for tracking logged-in users
    try {
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days (match JWT expiry)
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Parse user agent for device info
      const ua = (userAgent as string).toLowerCase();
      let deviceType = 'desktop';
      let browser = 'unknown';
      let os = 'unknown';

      // Detect device type
      if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
        deviceType = /ipad|tablet/i.test(ua) ? 'tablet' : 'mobile';
      }

      // Detect browser
      if (ua.includes('edg/')) browser = 'Edge';
      else if (ua.includes('chrome')) browser = 'Chrome';
      else if (ua.includes('firefox')) browser = 'Firefox';
      else if (ua.includes('safari')) browser = 'Safari';
      else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';
      else if (ua.includes('msie') || ua.includes('trident')) browser = 'IE';

      // Detect OS
      if (ua.includes('windows nt 10')) os = 'Windows 10/11';
      else if (ua.includes('windows')) os = 'Windows';
      else if (ua.includes('mac os x')) os = 'macOS';
      else if (ua.includes('android')) os = 'Android';
      else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
      else if (ua.includes('linux')) os = 'Linux';

      await query(`
        INSERT INTO active_sessions (user_id, token_hash, ip_address, user_agent, expires_at, device_type, browser, os, last_activity)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [user.id, tokenHash, ipAddress, userAgent, expiresAt, deviceType, browser, os]);

      logger.debug('Session created for user', { username: user.username, device: deviceType, browser, os });
    } catch (sessionError: any) {
      // Table might not exist yet - continue without session tracking
      logger.debug('Session tracking not available (table may not exist)');
    }

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        warehouseId: user.warehouse_id,
        permissions,
        warehouses: warehousesList,
        defaultWarehouseId: warehousesList.find((w: any) => w.is_default)?.warehouse_id || user.warehouse_id
      },
    });
  } catch (error: any) {
    logger.error('Login error', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { username, password, email, fullName } = req.body;

    if (!validateUsername(username)) {
      return res.status(400).json({ error: 'Invalid username (3-50 chars required)' });
    }

    // Use new password validation with detailed feedback
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    if (email && !validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const existingUser = await query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hashedPassword = await hashPassword(password);

    const result = await query(
      `INSERT INTO users (username, password_hash, email, full_name, role, is_active, created_at)
       VALUES ($1, $2, $3, $4, 'operator', true, NOW())
       RETURNING id, username, email, full_name, role`,
      [username, hashedPassword, email || null, fullName || null]
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0],
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
};
