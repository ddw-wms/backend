require('dotenv').config();
const { Pool } = require('pg');

(async () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('\n🧪 TESTING BATCH PERMISSION UPDATE\n');
        console.log('━'.repeat(60));

        // Get admin role ID
        const roleRes = await pool.query(`SELECT id FROM roles WHERE name = 'admin'`);
        const adminRoleId = roleRes.rows[0]?.id;
        console.log(`Admin role ID: ${adminRoleId}`);

        // Simulate what the API does - batch update
        const testPermissions = [
            { code: 'menu:dashboard', is_enabled: true, is_visible: true },
            { code: 'menu:inbound', is_enabled: true, is_visible: true },
            { code: 'menu:outbound', is_enabled: true, is_visible: true },
        ];

        const values = [];
        const placeholders = [];

        testPermissions.forEach((perm, idx) => {
            const offset = idx * 4;
            placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
            values.push(adminRoleId, perm.code, perm.is_enabled, perm.is_visible);
        });

        console.log('\n📝 Generated query:');
        console.log(`   INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)`);
        console.log(`   VALUES ${placeholders.join(', ')}`);
        console.log(`   ON CONFLICT ... DO UPDATE`);
        console.log(`\n   Values: [${values.join(', ')}]`);

        // Execute test
        console.log('\n⏳ Executing batch update...');
        const startTime = Date.now();

        await pool.query('BEGIN');
        await pool.query(`
            INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
            VALUES ${placeholders.join(', ')}
            ON CONFLICT (role_id, permission_code)
            DO UPDATE SET 
                is_enabled = EXCLUDED.is_enabled, 
                is_visible = EXCLUDED.is_visible,
                updated_at = NOW()
        `, values);
        await pool.query('COMMIT');

        const duration = Date.now() - startTime;
        console.log(`✅ Batch update successful! (${duration}ms)`);

        // Now test full batch (all permissions)
        console.log('\n⏳ Testing full permission batch (all 76 permissions)...');

        const allPerms = await pool.query(`SELECT code FROM permissions ORDER BY sort_order`);

        const fullValues = [];
        const fullPlaceholders = [];

        allPerms.rows.forEach((perm, idx) => {
            const offset = idx * 4;
            fullPlaceholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
            fullValues.push(adminRoleId, perm.code, true, true);
        });

        const fullStartTime = Date.now();

        await pool.query('BEGIN');
        await pool.query(`
            INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
            VALUES ${fullPlaceholders.join(', ')}
            ON CONFLICT (role_id, permission_code)
            DO UPDATE SET 
                is_enabled = EXCLUDED.is_enabled, 
                is_visible = EXCLUDED.is_visible,
                updated_at = NOW()
        `, fullValues);
        await pool.query('COMMIT');

        const fullDuration = Date.now() - fullStartTime;
        console.log(`✅ Full batch update successful! (${allPerms.rows.length} permissions in ${fullDuration}ms)`);

        console.log('\n' + '━'.repeat(60));
        console.log('✅ All tests passed!\n');

        await pool.end();
    } catch (e) {
        console.error('❌ Error:', e.message);
        console.error(e.stack);
        await pool.query('ROLLBACK').catch(() => { });
        await pool.end();
        process.exit(1);
    }
})();
