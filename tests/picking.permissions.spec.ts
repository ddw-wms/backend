import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../src/config/database', () => ({
    query: vi.fn(),
}));

import { hasPermission } from '../src/middleware/auth.middleware';
import { query } from '../src/config/database';

// Note: hasPermission returns a middleware factory. We'll call it and simulate req/res/next.

describe('hasPermission middleware (picking)', () => {
    beforeEach(() => {
        (query as any).mockReset();
    });

    it('denies access when role has no matching permissions', async () => {
        // Simulate role_permissions returning no rows for the required permission
        (query as any)
            .mockImplementationOnce(() => ({ rows: [] })) // user_permissions (none)
            .mockImplementationOnce(() => ({ rows: [{ permission_key: 'view_picking', enabled: true }] })) // all perms for role
            .mockImplementationOnce(() => ({ rows: [] })); // matching permissions (none)

        const mw = hasPermission('create_picking');
        const req: any = { user: { userId: 10, role: 'operator', username: 'test' }, path: '/api/picking/multi-entry', method: 'POST' };
        const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn().mockReturnValue(null) }), json: vi.fn() };
        const next = vi.fn();

        await mw(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('allows access when role has enabled permission', async () => {
        // First call: all perms list, second call: matching permission enabled
        (query as any)
            .mockImplementationOnce(() => ({ rows: [] })) // user_permissions (none)
            .mockImplementationOnce(() => ({ rows: [{ permission_key: 'view_picking', enabled: true }] }))
            .mockImplementationOnce(() => ({ rows: [{ permission_key: 'create_picking', enabled: true }] }));

        const mw = hasPermission('create_picking');
        const req: any = { user: { userId: 10, role: 'operator', username: 'test' }, path: '/api/picking/multi-entry', method: 'POST' };
        const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn().mockReturnValue(null) }), json: vi.fn() };
        const next = vi.fn();

        await mw(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('denies delete batch when role lacks delete_picking', async () => {
        (query as any)
            .mockImplementationOnce(() => ({ rows: [] })) // user_permissions (none)
            .mockImplementationOnce(() => ({ rows: [{ permission_key: 'view_picking', enabled: true }] }))
            .mockImplementationOnce(() => ({ rows: [] }));

        const mw = hasPermission('delete_picking');
        const req: any = { user: { userId: 11, role: 'operator', username: 'tester' }, path: '/api/picking/batch/123', method: 'DELETE' };
        const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn().mockReturnValue(null) }), json: vi.fn() };
        const next = vi.fn();

        await mw(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('allows delete batch when role has delete_picking', async () => {
        (query as any)
            .mockImplementationOnce(() => ({ rows: [] })) // user_permissions (none)
            .mockImplementationOnce(() => ({ rows: [{ permission_key: 'view_picking', enabled: true }] }))
            .mockImplementationOnce(() => ({ rows: [{ permission_key: 'delete_picking', enabled: true }] }));

        const mw = hasPermission('delete_picking');
        const req: any = { user: { userId: 11, role: 'operator', username: 'tester' }, path: '/api/picking/batch/123', method: 'DELETE' };
        const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn().mockReturnValue(null) }), json: vi.fn() };
        const next = vi.fn();

        await mw(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('allows admin regardless of role permissions', async () => {
        // admin bypass - user_permissions (if present) would be checked first, but admin bypasses
        (query as any)
            .mockImplementationOnce(() => ({ rows: [] })); // user_permissions (placeholder)

        const mw = hasPermission('delete_picking');
        const req: any = { user: { userId: 1, role: 'admin', username: 'admin' }, path: '/api/picking/batch/123', method: 'DELETE' };
        const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn().mockReturnValue(null) }), json: vi.fn() };
        const next = vi.fn();

        await mw(req, res, next);

        expect(next).toHaveBeenCalled();
    });
});