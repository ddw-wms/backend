import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../src/config/database', () => ({
    query: vi.fn(),
}));

import { hasPermission } from '../src/middleware/auth.middleware';
import { query } from '../src/config/database';

describe('hasPermission middleware (inbound UI settings)', () => {
    beforeEach(() => {
        (query as any).mockReset();
    });

    it('denies access to change inbound columns when role lacks permission', async () => {
        (query as any)
            .mockImplementationOnce(() => ({ rows: [] })) // user_permissions (none)
            .mockImplementationOnce(() => ({ rows: [{ permission_key: 'view_inbound', enabled: true }] }))
            .mockImplementationOnce(() => ({ rows: [] }));

        const mw = hasPermission('inbound_list_columns_settings');
        const req: any = { user: { userId: 20, role: 'operator', username: 'bob' }, path: '/api/inbound', method: 'GET' };
        const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn().mockReturnValue(null) }), json: vi.fn() };
        const next = vi.fn();

        await mw(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('allows access when role has inbound_list_columns_settings', async () => {
        (query as any)
            .mockImplementationOnce(() => ({ rows: [] })) // user_permissions (none)
            .mockImplementationOnce(() => ({ rows: [{ permission_key: 'view_inbound', enabled: true }] }))
            .mockImplementationOnce(() => ({ rows: [{ permission_key: 'inbound_list_columns_settings', enabled: true }] }));

        const mw = hasPermission('inbound_list_columns_settings');
        const req: any = { user: { userId: 20, role: 'operator', username: 'bob' }, path: '/api/inbound', method: 'GET' };
        const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn().mockReturnValue(null) }), json: vi.fn() };
        const next = vi.fn();

        await mw(req, res, next);

        expect(next).toHaveBeenCalled();
    });
});