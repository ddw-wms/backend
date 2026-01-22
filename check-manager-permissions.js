const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const roles = await pool.query('SELECT id, name FROM roles ORDER BY id');
        console.log('=== ROLES ===');
        console.table(roles.rows);

        const managerRole = roles.rows.find(r => r.name === 'manager');
        if (!managerRole) {
            console.log('Manager role not found!');
            process.exit(1);
        }
        console.log('Manager role found:', managerRole);

        const perms = await pool.query(
            'SELECT permission_code, is_enabled, is_visible FROM role_permissions WHERE role_id = $1 ORDER BY permission_code',
            [managerRole.id]
        );

        console.log('\n=== MANAGER PERMISSIONS ===');
        console.log('Total permissions:', perms.rows.length);
        const enabled = perms.rows.filter(p => p.is_enabled);
        console.log('Enabled permissions:', enabled.length);
        console.log(enabled.map(p => p.permission_code).join('\n'));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

check();
