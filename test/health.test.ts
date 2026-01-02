import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// Set env before importing app to avoid config errors
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.NODE_ENV = 'test';

import app from '../src/server';

describe('GET /api/health', () => {
    it('returns status OK', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('OK');
    });
});
