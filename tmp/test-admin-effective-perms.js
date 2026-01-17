// Test what admin user actually gets from effective_user_permissions
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        // First find admin user
        const userR = await pool.query("SELECT id, username, role FROM users WHERE role = 'admin' AND is_active = true LIMIT 1");
        if (userR.rows.length === 0) {
            console.log('No active admin user found!');
            return;
        }

        const adminUser = userR.rows[0];
        console.log(`\n📋 Admin user: ${adminUser.username} (ID: ${adminUser.id}, role: ${adminUser.role})\n`);

        // Get their effective permissions for dashboard buttons
        const permR = await pool.query(`
            SELECT permission_code, is_enabled, is_visible, permission_source
            FROM effective_user_permissions 
            WHERE user_id = $1 AND permission_code LIKE 'btn:dashboard%'
        `, [adminUser.id]);

        console.log('Dashboard button permissions for this user:');
        permR.rows.forEach(p => {
            const enableIcon = p.is_enabled ? '✅' : '❌';
            const visibleIcon = p.is_visible ? '👁️' : '🚫';
            console.log(`  ${enableIcon}${visibleIcon} ${p.permission_code} (source: ${p.permission_source})`);
        });

        // Also check what the VIEW is computing
        console.log('\n\n📊 Checking the VIEW SQL directly...');
        const viewDef = await pool.query(`
            SELECT pg_get_viewdef('effective_user_permissions', true)
        `);
        console.log('\nVIEW Definition:');
        console.log(viewDef.rows[0].pg_get_viewdef);

        await pool.end();
    } catch (e) {
        console.error('Error:', e.message);
        console.error(e.stack);
        await pool.end();
    }
})();
