import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the database query
vi.mock('../src/config/database', () => ({
    query: vi.fn(),
}));

import { userHasWarehouseAccess } from '../src/middleware/auth.middleware';
import { query } from '../src/config/database';

describe('userHasWarehouseAccess', () => {
    beforeEach(() => {
        (query as any).mockReset();
    });

    it('returns true when no assignments exist (global access)', async () => {
        (query as any).mockImplementationOnce(() => ({ rows: [] }));

        const res = await userHasWarehouseAccess(10, 1);
        expect(res).toBe(true);
    });

    it('returns true when assignment exists and enabled', async () => {
        (query as any)
            .mockImplementationOnce(() => ({ rows: [{ enabled: true }] })) // check for user entries
            .mockImplementationOnce(() => ({ rows: [{ enabled: true }] })); // check for specific warehouse

        const res = await userHasWarehouseAccess(10, 2);
        expect(res).toBe(true);
    });

    it('returns false when assignment exists but disabled', async () => {
        (query as any)
            .mockImplementationOnce(() => ({ rows: [{ enabled: true }] }))
            .mockImplementationOnce(() => ({ rows: [{ enabled: false }] }));

        const res = await userHasWarehouseAccess(10, 3);
        expect(res).toBe(false);
    });

    it('returns false when no specific warehouse assignment exists', async () => {
        (query as any)
            .mockImplementationOnce(() => ({ rows: [{ enabled: true }] }))
            .mockImplementationOnce(() => ({ rows: [] }));

        const res = await userHasWarehouseAccess(10, 4);
        expect(res).toBe(false);
    });
});