// File Path = warehouse-backend/src/middleware/rateLimit.middleware.ts
import { Request, Response, NextFunction } from 'express';

/**
 * Simple in-memory rate limiter
 * For production, use Redis-based solution
 */

interface RateLimitStore {
    [key: string]: {
        count: number;
        resetTime: number;
    };
}

const store: RateLimitStore = {};

/**
 * Rate limit middleware
 * @param maxRequests - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 */
export const rateLimit = (maxRequests: number, windowMs: number) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // Use IP address as key
        const key = req.ip || req.socket.remoteAddress || 'unknown';
        const now = Date.now();

        // Clean up old entries
        if (Object.keys(store).length > 10000) {
            Object.keys(store).forEach(k => {
                if (store[k].resetTime < now) {
                    delete store[k];
                }
            });
        }

        // Initialize or get existing record
        if (!store[key] || store[key].resetTime < now) {
            store[key] = {
                count: 1,
                resetTime: now + windowMs
            };
            return next();
        }

        // Increment count
        store[key].count++;

        // Check if limit exceeded
        if (store[key].count > maxRequests) {
            const remainingTime = Math.ceil((store[key].resetTime - now) / 1000);
            return res.status(429).json({
                error: 'Too many requests',
                message: `Please try again after ${remainingTime} seconds`,
                retryAfter: remainingTime
            });
        }

        next();
    };
};

/**
 * Stricter rate limit for login attempts
 * 5 attempts per 15 minutes
 */
export const loginRateLimit = rateLimit(5, 15 * 60 * 1000);

/**
 * General API rate limit
 * 100 requests per minute
 */
export const apiRateLimit = rateLimit(100, 60 * 1000);
