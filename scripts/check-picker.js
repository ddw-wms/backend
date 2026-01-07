require('dotenv').config();
const { Pool } = require('pg');
(async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        const res = await pool.query("SELECT COUNT(*) FILTER (WHERE enabled=true) as enabled_count, COUNT(*) as total_count FROM role_permissions WHERE role='picker'");
        console.log('picker role permissions:', res.rows[0]);
        const rows = await pool.query("SELECT permission_key, enabled FROM role_permissions WHERE role='picker' ORDER BY permission_key");
        console.log('sample rows (first 20):');
        rows.rows.slice(0, 20).forEach(r => console.log(`  ${r.permission_key} => ${r.enabled}`));
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
})();
