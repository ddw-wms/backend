// File Path = warehouse-backend/src/middleware/errorHandler.middleware.ts
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { query } from '../config/database';

// Parse stack trace to get file and line info
const parseStackTrace = (stack: string | undefined): string => {
  if (!stack) return '';

  // Get relevant lines (skip first line which is the error message)
  const lines = stack.split('\n').slice(1, 6); // Get first 5 stack frames

  // Clean up and format
  return lines
    .map(line => line.trim())
    .filter(line => line.startsWith('at '))
    .join('\n');
};

// Enhanced error logging to database
const logErrorToDb = async (
  message: string,
  endpoint: string,
  method: string,
  username: string,
  stackTrace: string
) => {
  try {
    await query(
      `INSERT INTO error_logs (message, endpoint, method, username, stack_trace) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        message.substring(0, 500),
        endpoint,
        method,
        username,
        stackTrace.substring(0, 2000) // Limit stack trace size
      ]
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
  // Log to console with full details
  logger.error('API Error', error, {
    endpoint: req.path,
    method: req.method,
    user: req.user?.username || 'anonymous',
    stack: error.stack
  });

  // Parse stack trace for file/line info
  const stackTrace = parseStackTrace(error.stack);

  // Log to database (async - don't wait)
  logErrorToDb(
    error.message || 'Unknown error',
    req.path,
    req.method,
    req.user?.username || 'anonymous',
    stackTrace
  );

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    error: 'An error occurred. Please try again.',
    timestamp: new Date().toISOString(),
    path: req.path,
  });
};
