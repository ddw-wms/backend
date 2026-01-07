require('dotenv').config();
const { Pool } = require('pg');
(async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        const users = await pool.query("SELECT id, username, full_name, role FROM users WHERE role='picker' LIMIT 5");
        console.log('picker users:', users.rows);
        if (users.rows.length > 0) {
            const user = users.rows[0];
            const up = await pool.query('SELECT permission_key, enabled FROM user_permissions WHERE user_id=$1', [user.id]);
            console.log(`user_permissions for ${user.username} (id=${user.id}):`, up.rows.slice(0, 20));
        }
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
})();
