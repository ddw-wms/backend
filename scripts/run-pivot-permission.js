require('dotenv').config();
const { Pool } = require('pg');

(async () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('\n🚀 Adding Pivot Table Permission...\n');
        console.log('━'.repeat(60));

        // Add pivot permission (using correct column names: code, name, category, page)
        const insertResult = await pool.query(`
            INSERT INTO permissions (code, name, description, category, page, sort_order) 
            VALUES ('btn:dashboard:pivot', 'Dashboard Pivot Analysis Button', 'Excel-style pivot table for inventory analysis', 'button', 'dashboard', 110)
            ON CONFLICT (code) DO NOTHING
            RETURNING *
        `);

        if (insertResult.rows.length > 0) {
            console.log('✅ Permission added: btn:dashboard:pivot');
        } else {
            console.log('ℹ️  Permission already exists: btn:dashboard:pivot');
        }

        // Get admin role id
        const adminRole = await pool.query(`SELECT id FROM roles WHERE role_name = 'Admin' LIMIT 1`);
        if (adminRole.rows.length > 0) {
            const adminRoleId = adminRole.rows[0].id;
            await pool.query(`
                INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
                VALUES ($1, 'btn:dashboard:pivot', true, true)
                ON CONFLICT (role_id, permission_code) DO UPDATE SET is_enabled = true, is_visible = true
            `, [adminRoleId]);
            console.log('✅ Granted to Admin role');
        }

        // Get manager role id
        const managerRole = await pool.query(`SELECT id FROM roles WHERE role_name = 'Manager' LIMIT 1`);
        if (managerRole.rows.length > 0) {
            const managerRoleId = managerRole.rows[0].id;
            await pool.query(`
                INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
                VALUES ($1, 'btn:dashboard:pivot', true, true)
                ON CONFLICT (role_id, permission_code) DO UPDATE SET is_enabled = true, is_visible = true
            `, [managerRoleId]);
            console.log('✅ Granted to Manager role');
        }

        // Get supervisor role id
        const supervisorRole = await pool.query(`SELECT id FROM roles WHERE role_name = 'Supervisor' LIMIT 1`);
        if (supervisorRole.rows.length > 0) {
            const supervisorRoleId = supervisorRole.rows[0].id;
            await pool.query(`
                INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
                VALUES ($1, 'btn:dashboard:pivot', true, true)
                ON CONFLICT (role_id, permission_code) DO UPDATE SET is_enabled = true, is_visible = true
            `, [supervisorRoleId]);
            console.log('✅ Granted to Supervisor role');
        }

        // Verify
        const verify = await pool.query(`
            SELECT * FROM permissions WHERE code = 'btn:dashboard:pivot'
        `);
        console.log('\n📋 Permission details:');
        console.log(verify.rows[0]);

        // Count dashboard permissions
        const dashPerms = await pool.query(`
            SELECT COUNT(*) as count FROM permissions WHERE page = 'dashboard'
        `);
        console.log(`\n📊 Total dashboard permissions: ${dashPerms.rows[0].count}`);

        console.log('\n━'.repeat(60));
        console.log('✅ Pivot permission setup complete!\n');

    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        await pool.end();
    }
})();
