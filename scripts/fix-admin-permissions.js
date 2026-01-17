require('dotenv').config();
const { Pool } = require('pg');

(async () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('\n🔧 FIXING ADMIN PERMISSIONS\n');
        console.log('━'.repeat(60));

        // Get admin role ID
        const roleResult = await pool.query(`SELECT id FROM roles WHERE name = 'admin'`);
        if (roleResult.rows.length === 0) {
            console.log('❌ Admin role not found!');
            return;
        }
        const adminRoleId = roleResult.rows[0].id;
        console.log(`Admin role ID: ${adminRoleId}`);

        // List of permissions to enable for admin
        const permissionsToEnable = [
            'menu:settings:permissions',  // Permissions page
            'menu:settings:errorlogs',    // Error logs page
        ];

        console.log('\n📝 Enabling permissions for admin:');

        for (const permCode of permissionsToEnable) {
            await pool.query(`
                INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
                VALUES ($1, $2, true, true)
                ON CONFLICT (role_id, permission_code) 
                DO UPDATE SET is_enabled = true, is_visible = true, updated_at = NOW()
            `, [adminRoleId, permCode]);
            console.log(`   ✅ ${permCode}`);
        }

        // Verify changes
        console.log('\n🔍 Verifying changes:');
        const verify = await pool.query(`
            SELECT p.code, rp.is_enabled, rp.is_visible
            FROM permissions p
            JOIN role_permissions rp ON rp.permission_code = p.code
            JOIN roles r ON r.id = rp.role_id
            WHERE r.name = 'admin' AND p.code LIKE 'menu:settings:%'
            ORDER BY p.sort_order
        `);
        verify.rows.forEach(row => {
            const status = row.is_visible ? '✅' : '❌';
            console.log(`   ${status} ${row.code}: enabled=${row.is_enabled}, visible=${row.is_visible}`);
        });

        console.log('\n' + '━'.repeat(60));
        console.log('✅ Admin permissions fixed!\n');

        await pool.end();
    } catch (e) {
        console.error('❌ Error:', e.message);
        await pool.end();
        process.exit(1);
    }
})();
