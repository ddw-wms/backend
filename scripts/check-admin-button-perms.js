// Script to check admin's specific button permissions
require('dotenv').config();
const { Pool } = require('pg');

(async () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('\n📊 ADMIN BUTTON PERMISSIONS CHECK\n');
        console.log('━'.repeat(60));

        // Get admin role id
        const adminRole = await pool.query(`SELECT id FROM roles WHERE name = 'admin'`);
        const adminRoleId = adminRole.rows[0]?.id;
        console.log(`Admin role ID: ${adminRoleId}`);

        // Check all button permissions for admin
        console.log('\n🔘 Admin Button Permissions (btn:*):');
        const btnPerms = await pool.query(`
            SELECT p.code, p.name, p.page, 
                   COALESCE(rp.is_enabled, false) as is_enabled, 
                   COALESCE(rp.is_visible, false) as is_visible
            FROM permissions p
            LEFT JOIN role_permissions rp ON rp.permission_code = p.code AND rp.role_id = $1
            WHERE p.code LIKE 'btn:%'
            ORDER BY p.page, p.code
        `, [adminRoleId]);

        btnPerms.rows.forEach(row => {
            const enabledIcon = row.is_enabled ? '✅' : '❌';
            const visibleIcon = row.is_visible ? '👁️' : '🚫';
            console.log(`   ${enabledIcon}${visibleIcon} [${row.page}] ${row.code}`);
        });

        // Check specifically disabled ones
        console.log('\n🚫 DISABLED Admin Permissions:');
        const disabledPerms = await pool.query(`
            SELECT p.code, p.name, p.page, rp.is_enabled, rp.is_visible
            FROM permissions p
            JOIN role_permissions rp ON rp.permission_code = p.code AND rp.role_id = $1
            WHERE rp.is_enabled = false OR rp.is_visible = false
            ORDER BY p.page, p.code
        `, [adminRoleId]);

        if (disabledPerms.rows.length === 0) {
            console.log('   ⚠️  No permissions are disabled for admin!');
        } else {
            disabledPerms.rows.forEach(row => {
                console.log(`   ${row.code}: enabled=${row.is_enabled}, visible=${row.is_visible}`);
            });
        }

        // Check what satnam (admin user) actually gets from effective_user_permissions
        console.log('\n🔍 Checking effective permissions for admin user satnam:');
        const effPerms = await pool.query(`
            SELECT permission_code, permission_name, is_enabled, is_visible, permission_source
            FROM effective_user_permissions 
            WHERE user_id = 21 AND (is_enabled = false OR is_visible = false)
            ORDER BY permission_code
        `);

        if (effPerms.rows.length === 0) {
            console.log('   ⚠️  All permissions are enabled and visible for satnam!');
        } else {
            effPerms.rows.forEach(row => {
                console.log(`   ${row.permission_code}: enabled=${row.is_enabled}, visible=${row.is_visible} (source: ${row.permission_source})`);
            });
        }

        console.log('\n' + '━'.repeat(60));
        await pool.end();
    } catch (e) {
        console.error('❌ Error:', e.message);
        console.error(e.stack);
        await pool.end();
        process.exit(1);
    }
})();
