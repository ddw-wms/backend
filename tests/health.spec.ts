import { describe, it, expect } from 'vitest';

describe('Server Health', () => {
    it('should have correct NODE_ENV configuration', () => {
        // Basic sanity check
        expect(['development', 'test', 'production', undefined]).toContain(process.env.NODE_ENV);
    });

    it('should have valid package configuration', async () => {
        const pkg = await import('../package.json');
        expect(pkg.name).toBe('warehouse-backend');
        expect(pkg.version).toBeDefined();
    });
});

describe('Environment Variables', () => {
    it('should validate required env vars are documented', async () => {
        const fs = await import('fs');
        const path = await import('path');

        const envExamplePath = path.join(__dirname, '..', '.env.example');
        const exists = fs.existsSync(envExamplePath);
        expect(exists).toBe(true);
    });
});
