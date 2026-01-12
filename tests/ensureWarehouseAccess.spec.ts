import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../src/config/database', () => ({
    query: vi.fn(),
}));

import { ensureWarehouseAccess } from '../src/middleware/auth.middleware';
import { query } from '../src/config/database';

const makeReq = (user: any, params: any = {}, body: any = {}, queryObj: any = {}) => ({ user, params, body, query: queryObj });
const makeRes = () => {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
};

describe('ensureWarehouseAccess middleware', () => {
    beforeEach(() => {
        (query as any).mockReset();
    });

    it('allows when no warehouse id present', async () => {
        const req: any = makeReq({ userId: 5 });
        const res = makeRes();
        const next = vi.fn();

        const mw = ensureWarehouseAccess();
        await mw(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('denies when user has no access to specified warehouse', async () => {
        // First query: user entries exist
        (query as any)
            .mockImplementationOnce(() => ({ rows: [{ enabled: true }] }))
            .mockImplementationOnce(() => ({ rows: [{ enabled: false }] }));

        const req: any = makeReq({ userId: 8 }, { warehouseId: '3' });
        const res = makeRes();
        const next = vi.fn();

        const mw = ensureWarehouseAccess();
        await mw(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Forbidden: No access to requested warehouse' }));
        expect(next).not.toHaveBeenCalled();
    });

    it('allows when user has access', async () => {
        (query as any)
            .mockImplementationOnce(() => ({ rows: [{ enabled: true }] }))
            .mockImplementationOnce(() => ({ rows: [{ enabled: true }] }));

        const req: any = makeReq({ userId: 8 }, {}, { warehouse_id: 2 });
        const res = makeRes();
        const next = vi.fn();

        const mw = ensureWarehouseAccess();
        await mw(req, res, next);

        expect(next).toHaveBeenCalled();
    });
});