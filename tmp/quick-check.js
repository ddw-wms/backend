// Quick check script
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        const r = await pool.query("SELECT code, name, page FROM permissions WHERE code LIKE 'btn:dashboard%'");
        console.log('Dashboard button permissions:');
        console.log(r.rows);
        await pool.end();
    } catch (e) {
        console.error(e);
        await pool.end();
    }
})();
