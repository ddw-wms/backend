require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

(async () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('\n🚀 Adding Appearance & Error Logs Permissions...\n');
        console.log('━'.repeat(60));

        const sql = fs.readFileSync('migrations/add_appearance_errorlogs_permissions.sql', 'utf8');
        await pool.query(sql);

        console.log('✅ Migration executed successfully!\n');

        // Show permissions
        const result = await pool.query(`
            SELECT code, name FROM permissions 
            WHERE code LIKE 'menu:settings:appearance%' 
               OR code LIKE 'menu:settings:errorlogs%'
            ORDER BY code
        `);

        console.log('📋 Permissions in database:');
        result.rows.forEach(r => console.log(`   - ${r.code}: ${r.name}`));

        // Check role_permissions for admin
        const rolePerms = await pool.query(`
            SELECT rp.permission_code, rp.is_enabled, rp.is_visible
            FROM role_permissions rp
            JOIN roles r ON r.id = rp.role_id
            WHERE r.name = 'admin' 
              AND (rp.permission_code LIKE 'menu:settings:appearance%' 
                   OR rp.permission_code LIKE 'menu:settings:errorlogs%')
        `);

        console.log('\n📋 Admin role permissions:');
        if (rolePerms.rows.length === 0) {
            console.log('   No permissions granted to admin yet');
        } else {
            rolePerms.rows.forEach(r => console.log(`   - ${r.permission_code}: enabled=${r.is_enabled}, visible=${r.is_visible}`));
        }

        console.log('\n' + '━'.repeat(60));
        console.log('✅ Complete!\n');

        await pool.end();
    } catch (e) {
        console.error('❌ Error:', e.message);
        await pool.end();
        process.exit(1);
    }
})();
