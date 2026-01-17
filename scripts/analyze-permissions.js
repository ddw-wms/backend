require('dotenv').config();
const { Pool } = require('pg');

(async () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('\n📊 PERMISSION SYSTEM ANALYSIS\n');
        console.log('━'.repeat(60));

        // 1. Check role permission counts
        console.log('\n👥 Role permission counts (visible=true):');
        const rolePerms = await pool.query(`
            SELECT r.name as role, COUNT(rp.permission_code) as perm_count 
            FROM roles r 
            LEFT JOIN role_permissions rp ON rp.role_id = r.id AND rp.is_visible = true 
            GROUP BY r.name 
            ORDER BY perm_count DESC
        `);
        rolePerms.rows.forEach(row => console.log(`   ${row.role}: ${row.perm_count} permissions`));

        // 2. Check admin's specific permissions
        console.log('\n🔑 Admin role permissions for menu items:');
        const adminMenuPerms = await pool.query(`
            SELECT p.code, p.name, rp.is_enabled, rp.is_visible
            FROM permissions p
            LEFT JOIN roles r ON r.name = 'admin'
            LEFT JOIN role_permissions rp ON rp.permission_code = p.code AND rp.role_id = r.id
            WHERE p.code LIKE 'menu:%'
            ORDER BY p.sort_order
        `);
        adminMenuPerms.rows.forEach(row => {
            const status = row.is_enabled === null ? '❌ NOT SET' : (row.is_visible ? '✅' : '🚫');
            console.log(`   ${status} ${row.code}: enabled=${row.is_enabled}, visible=${row.is_visible}`);
        });

        // 3. Check total permissions in system
        const totalPerms = await pool.query('SELECT COUNT(*) as total FROM permissions');
        console.log(`\n📋 Total permissions in system: ${totalPerms.rows[0].total}`);

        // 4. Check if effective_user_permissions view exists and works
        console.log('\n🔍 Testing effective_user_permissions view:');
        try {
            const testUser = await pool.query(`
                SELECT u.id, u.username, u.role FROM users u WHERE u.role = 'admin' LIMIT 1
            `);
            if (testUser.rows.length > 0) {
                const adminUser = testUser.rows[0];
                console.log(`   Testing with admin user: ${adminUser.username} (id: ${adminUser.id})`);

                const effPerms = await pool.query(`
                    SELECT COUNT(*) as count, 
                           COUNT(CASE WHEN is_visible = true THEN 1 END) as visible_count
                    FROM effective_user_permissions 
                    WHERE user_id = $1
                `, [adminUser.id]);
                console.log(`   Effective permissions: ${effPerms.rows[0].count} total, ${effPerms.rows[0].visible_count} visible`);
            }
        } catch (e) {
            console.log(`   ❌ View error: ${e.message}`);
        }

        console.log('\n' + '━'.repeat(60));
        console.log('✅ Analysis complete!\n');

        await pool.end();
    } catch (e) {
        console.error('❌ Error:', e.message);
        await pool.end();
        process.exit(1);
    }
})();
