require('dotenv').config();
const { Pool } = require('pg');

(async () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('\n🔍 Checking Dashboard Filter Permission...\n');

        // Check if filter_dashboard exists
        const check = await pool.query(`
            SELECT permission_key, permission_name, category 
            FROM permissions 
            WHERE permission_key = 'filter_dashboard' 
               OR permission_key = 'dashboard_filter_warehouse'
               OR permission_key LIKE '%dashboard%filter%'
        `);

        console.log('Found permissions:', check.rows);

        if (check.rows.length === 0) {
            console.log('\n❌ filter_dashboard permission NOT found!');
            console.log('✅ Adding missing permission...');

            // Add the missing permission
            await pool.query(`
                INSERT INTO permissions (permission_key, permission_name, category, description)
                VALUES ('filter_dashboard', 'Dashboard Filter Controls', 'dashboard', 'Access to dashboard filter controls')
                ON CONFLICT (permission_key) DO NOTHING
            `);

            console.log('✅ Permission added!');
        } else {
            console.log('\n✅ Dashboard filter permissions exist!');
        }

        // Enable for picker
        console.log('\n⚙️  Enabling filter permissions for picker...');
        await pool.query(`
            INSERT INTO role_permissions (role, permission_key, enabled)
            SELECT 'picker', permission_key, true
            FROM permissions
            WHERE permission_key LIKE '%dashboard%filter%' 
               OR permission_key = 'filter_dashboard'
            ON CONFLICT (role, permission_key) DO UPDATE SET enabled = true
        `);

        console.log('✅ Done!\n');

    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        await pool.end();
    }
})();
