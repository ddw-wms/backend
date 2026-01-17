require('dotenv').config();
const { Pool } = require('pg');

(async () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('\n🔍 PERMISSIONS SYSTEM FULL AUDIT\n');
        console.log('━'.repeat(70));

        // 1. Check role_permissions table structure
        console.log('\n📋 role_permissions table structure:');
        const tableStruct = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'role_permissions' 
            ORDER BY ordinal_position
        `);
        tableStruct.rows.forEach(row => {
            console.log(`   ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });

        // 2. Check constraints
        console.log('\n🔒 Constraints on role_permissions:');
        const constraints = await pool.query(`
            SELECT conname, pg_get_constraintdef(oid) as def 
            FROM pg_constraint 
            WHERE conrelid = 'role_permissions'::regclass
        `);
        constraints.rows.forEach(row => {
            console.log(`   ${row.conname}: ${row.def}`);
        });

        // 3. Check if updated_at column exists
        console.log('\n📝 Checking updated_at column:');
        const hasUpdatedAt = tableStruct.rows.some(r => r.column_name === 'updated_at');
        if (hasUpdatedAt) {
            console.log('   ✅ updated_at column exists');
        } else {
            console.log('   ❌ updated_at column MISSING - this may cause save error!');
        }

        // 4. Test INSERT/UPDATE
        console.log('\n🧪 Testing UPDATE query:');
        try {
            // Get admin role id
            const roleRes = await pool.query(`SELECT id FROM roles WHERE name = 'admin'`);
            const adminRoleId = roleRes.rows[0]?.id;

            if (adminRoleId) {
                // Try updating a permission
                const testPerm = await pool.query(`
                    SELECT permission_code FROM role_permissions WHERE role_id = $1 LIMIT 1
                `, [adminRoleId]);

                if (testPerm.rows.length > 0) {
                    const permCode = testPerm.rows[0].permission_code;
                    console.log(`   Testing update for: ${permCode}`);

                    // Check if updated_at exists before using it
                    if (hasUpdatedAt) {
                        await pool.query(`
                            UPDATE role_permissions 
                            SET is_enabled = is_enabled, updated_at = NOW()
                            WHERE role_id = $1 AND permission_code = $2
                        `, [adminRoleId, permCode]);
                    } else {
                        await pool.query(`
                            UPDATE role_permissions 
                            SET is_enabled = is_enabled
                            WHERE role_id = $1 AND permission_code = $2
                        `, [adminRoleId, permCode]);
                    }
                    console.log('   ✅ UPDATE query works');
                }
            }
        } catch (e) {
            console.log(`   ❌ UPDATE error: ${e.message}`);
        }

        // 5. Test INSERT with ON CONFLICT
        console.log('\n🧪 Testing INSERT ON CONFLICT:');
        try {
            const roleRes = await pool.query(`SELECT id FROM roles WHERE name = 'admin'`);
            const adminRoleId = roleRes.rows[0]?.id;

            if (adminRoleId) {
                if (hasUpdatedAt) {
                    await pool.query(`
                        INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
                        VALUES ($1, 'menu:dashboard', true, true)
                        ON CONFLICT (role_id, permission_code)
                        DO UPDATE SET 
                            is_enabled = EXCLUDED.is_enabled, 
                            is_visible = EXCLUDED.is_visible,
                            updated_at = NOW()
                    `, [adminRoleId]);
                } else {
                    await pool.query(`
                        INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
                        VALUES ($1, 'menu:dashboard', true, true)
                        ON CONFLICT (role_id, permission_code)
                        DO UPDATE SET 
                            is_enabled = EXCLUDED.is_enabled, 
                            is_visible = EXCLUDED.is_visible
                    `, [adminRoleId]);
                }
                console.log('   ✅ INSERT ON CONFLICT works');
            }
        } catch (e) {
            console.log(`   ❌ INSERT ON CONFLICT error: ${e.message}`);
        }

        // 6. Check for unique constraint on role_id + permission_code
        console.log('\n🔑 Checking unique constraint:');
        const uniqueConstraint = constraints.rows.find(c =>
            c.def.includes('UNIQUE') &&
            (c.def.includes('role_id') && c.def.includes('permission_code'))
        );
        if (uniqueConstraint) {
            console.log(`   ✅ Unique constraint exists: ${uniqueConstraint.conname}`);
        } else {
            console.log('   ❌ No unique constraint on (role_id, permission_code) - ON CONFLICT will fail!');
        }

        // 7. Check permissions count
        console.log('\n📊 Permission counts:');
        const permCount = await pool.query('SELECT COUNT(*) as total FROM permissions');
        console.log(`   Total permissions: ${permCount.rows[0].total}`);

        const rolePermCount = await pool.query('SELECT COUNT(*) as total FROM role_permissions');
        console.log(`   Total role_permissions entries: ${rolePermCount.rows[0].total}`);

        // 8. Check for orphaned role_permissions
        console.log('\n🔍 Checking for orphaned permissions:');
        const orphaned = await pool.query(`
            SELECT rp.permission_code
            FROM role_permissions rp
            LEFT JOIN permissions p ON p.code = rp.permission_code
            WHERE p.code IS NULL
        `);
        if (orphaned.rows.length > 0) {
            console.log(`   ⚠️  Found ${orphaned.rows.length} orphaned role_permissions (permission doesn't exist)`);
            orphaned.rows.slice(0, 5).forEach(r => console.log(`      - ${r.permission_code}`));
        } else {
            console.log('   ✅ No orphaned permissions');
        }

        console.log('\n' + '━'.repeat(70));
        console.log('✅ Audit complete!\n');

        await pool.end();
    } catch (e) {
        console.error('❌ Error:', e.message);
        console.error(e.stack);
        await pool.end();
        process.exit(1);
    }
})();
