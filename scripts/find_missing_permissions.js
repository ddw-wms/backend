// Script compares frontend-generated permission_manifest.json to DB permissions
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

        const res = await client.query('SELECT permission_key FROM permissions');
        const existing = new Set(res.rows.map(r => r.permission_key));

        const missing = Array.from(used).filter(k => !existing.has(k));

        console.log('Permissions found in frontend manifest:', used.size);
        console.log('Permissions currently in DB:', existing.size);

        if (missing.length === 0) {
            console.log('✅ No missing permissions.');
        } else {
            console.log(`⚠️ Missing ${missing.length} permission definitions (present in frontend but missing in DB):`);
            missing.forEach(k => console.log('  -', k));

            console.log('\nSuggested SQL to insert missing permissions (edit descriptions/categories as needed):\n');
            missing.forEach(k => {
                const category = k.split('_')[1] || 'misc';
                const name = k.replace(/_/g, ' ').replace(/(^|\s)\S/g, l => l.toUpperCase());
                console.log(`INSERT INTO permissions (permission_key, permission_name, category, description) VALUES ('${k}', '${name}', '${category}', 'Auto-added from manifest') ON CONFLICT (permission_key) DO NOTHING;`);
            });
        }

        await client.end();
    } catch (err) {
        console.error('Error:', err.message || err);
        process.exit(1);
    }
})();