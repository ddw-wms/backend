// File Path = warehouse-backend/src/middleware/timeout.middleware.ts
import { Request, Response, NextFunction } from 'express';

/**
 * Request timeout middleware
 * Prevents requests from hanging indefinitely
 * 
 * @param timeoutMs - Timeout in milliseconds (default: 30 seconds)
 */
export const requestTimeout = (timeoutMs: number = 30000) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // Set timeout
        const timeout = setTimeout(() => {
            if (!res.headersSent) {
                res.status(408).json({
                    error: 'Request Timeout',
                    message: 'Request took too long to process',
                    timeout: `${timeoutMs / 1000}s`
                });
            }
        }, timeoutMs);

        // Clear timeout when response finishes
        res.on('finish', () => {
            clearTimeout(timeout);
        });

        next();
    };
};

/**
 * Longer timeout for file uploads (5 minutes)
 */
export const uploadTimeout = requestTimeout(5 * 60 * 1000);

/**
 * Standard timeout for API requests (30 seconds)
 */
export const apiTimeout = requestTimeout(30 * 1000);
