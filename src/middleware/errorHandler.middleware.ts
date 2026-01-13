// File Path = warehouse-backend/src/middleware/errorHandler.middleware.ts
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { query } from '../config/database';

// Simple error logging to database (for super_admin dashboard)
const logErrorToDb = async (message: string, endpoint: string, username: string) => {
  try {
    await query(
      'INSERT INTO error_logs (message, endpoint, username) VALUES ($1, $2, $3)',
      [message.substring(0, 500), endpoint, username]
    );
  } catch {
    // Silent fail - don't break app if logging fails
  }
};

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log to console
  logger.error('API Error', error, {
    endpoint: req.path,
    method: req.method,
    user: req.user?.username || 'anonymous',
  });

  // Log to database (async - don't wait)
  logErrorToDb(
    error.message || 'Unknown error',
    `${req.method} ${req.path}`,
    req.user?.username || 'anonymous'
  );

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    error: 'An error occurred. Please try again.',
    timestamp: new Date().toISOString(),
    path: req.path,
  });
};
