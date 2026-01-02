import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// mock the database module
vi.mock('../src/config/database', () => {
    return {
        query: vi.fn(),
    };
});

import app from '../src/server';
import { query } from '../src/config/database';
import { hashPassword } from '../src/utils/helpers';

describe('Auth Controller', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
        // noop
    });

    it('returns 401 for invalid login credentials', async () => {
        // query for user returns empty rows
        (query as any).mockResolvedValueOnce({ rows: [] });

        const res = await request(app).post('/api/auth/login').send({ username: 'nouser', password: 'abc' });

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });

    it('returns token and user object on successful login', async () => {
        // fake hashed password
        const pw = await hashPassword('mypassword');

        const fakeUser = {
            id: 42,
            username: 'jdoe',
            full_name: 'John Doe',
            email: 'jdoe@example.com',
            role: 'operator',
            warehouse_id: null,
            password_hash: pw,
        };

        // first query (SELECT) returns user
        (query as any).mockResolvedValueOnce({ rows: [fakeUser] });
        // second query (UPDATE last_login)
        (query as any).mockResolvedValueOnce({ rows: [] });

        const res = await request(app).post('/api/auth/login').send({ username: 'jdoe', password: 'mypassword' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body).toHaveProperty('user');
        expect(res.body.user.username).toBe('jdoe');
    });

    it('registers a new user', async () => {
        // check existing user -> none
        (query as any).mockResolvedValueOnce({ rows: [] });
        // insert returns user record
        (query as any).mockResolvedValueOnce({ rows: [{ id: 101, username: 'newuser', email: 'x@y.com', full_name: 'New User', role: 'operator' }] });

        const res = await request(app).post('/api/auth/register').send({ username: 'newuser', password: 'secure123', email: 'x@y.com', fullName: 'New User' });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('user');
        expect(res.body.user.username).toBe('newuser');
    });
});
