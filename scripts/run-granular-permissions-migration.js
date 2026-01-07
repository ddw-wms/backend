require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

(async () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('\n🚀 Adding Granular UI Permissions...\n');
        console.log('━'.repeat(60));

        const sql = fs.readFileSync('migrations/add_granular_ui_permissions.sql', 'utf8');
        await pool.query(sql);

        console.log('✅ Granular UI permissions migration executed!');

        const count = await pool.query('SELECT COUNT(*) as total FROM permissions');
        console.log(`\n📊 Total permissions in system: ${count.rows[0].total}`);

        // Count by category
        const categories = await pool.query(`
            SELECT category, COUNT(*) as count 
            FROM permissions 
            GROUP BY category 
            ORDER BY count DESC
        `);

        console.log('\n📋 Permissions by category:');
        categories.rows.forEach(cat => {
            console.log(`   ${cat.category}: ${cat.count}`);
        });

        // Auto-enable all for admin
        console.log('\n⚙️  Enabling all permissions for admin role...');
        const adminResult = await pool.query(`
            INSERT INTO role_permissions (role, permission_key, enabled)
            SELECT 'admin', permission_key, true
            FROM permissions
            ON CONFLICT (role, permission_key) DO UPDATE SET enabled = true
        `);

        console.log(`✅ Admin role updated with all permissions`);

        console.log('\n━'.repeat(60));
        console.log('✅ Complete! All granular UI permissions added successfully!\n');

    } catch (e) {
        console.error('❌ Error:', e.message);
        console.error(e);
        process.exit(1);
    } finally {
        await pool.end();
    }
})();
