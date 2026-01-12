// Script to prune unused permissions from DB
// Usage: node scripts/prune_unused_permissions.js [--force]

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

(async () => {
    try {
        const manifestPath = path.join(process.cwd(), '..', 'wms_frontend', 'permission_manifest.json');
        if (!fs.existsSync(manifestPath)) {
            console.error('Permission manifest not found. Run scripts/generate_permission_manifest.js first.');
            process.exit(1);
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const used = new Set(manifest.permissions || []);

        const client = new Client({ connectionString: process.env.DATABASE_URL });
        await client.connect();

        const res = await client.query('SELECT permission_key, permission_name, category FROM permissions ORDER BY category, permission_key');
        const all = res.rows;

        const candidates = all.filter(p => !used.has(p.permission_key));

        console.log('Total permissions in DB:', all.length);
        console.log('Used permissions in manifest:', used.size);
        console.log('Candidates for removal (not referenced in frontend manifest):', candidates.length);
        candidates.forEach(c => console.log(`  - ${c.permission_key} (${c.category}) - ${c.permission_name}`));

        if (candidates.length === 0) {
            console.log('No unused permissions detected. Exiting.');
            await client.end();
            process.exit(0);
        }

        if (process.argv.includes('--force')) {
            console.log('\nDeleting candidates...');
            const keys = candidates.map(c => c.permission_key);
            const delRes = await client.query('DELETE FROM role_permissions WHERE permission_key = ANY($1::text[]) RETURNING *', [keys]);
            console.log('Deleted from role_permissions:', delRes.rowCount);
            const del2 = await client.query('DELETE FROM user_permissions WHERE permission_key = ANY($1::text[]) RETURNING *', [keys]);
            console.log('Deleted from user_permissions:', del2.rowCount);
            const del3 = await client.query('DELETE FROM permissions WHERE permission_key = ANY($1::text[]) RETURNING *', [keys]);
            console.log('Deleted from permissions:', del3.rowCount);
            console.log('Prune complete.');
        } else {
            console.log('\nRun this script with --force to actually delete these permissions.');
        }

        await client.end();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
})();