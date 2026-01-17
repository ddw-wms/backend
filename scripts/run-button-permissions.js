require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

(async () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('\n🚀 Adding New Button Permissions...\n');
        console.log('━'.repeat(60));

        const sql = fs.readFileSync('migrations/add_new_button_permissions.sql', 'utf8');
        await pool.query(sql);

        console.log('✅ Migration executed successfully!\n');

        // Show new permissions
        const result = await pool.query(`
            SELECT code, name FROM permissions 
            WHERE code LIKE 'btn:masterdata%' 
               OR code LIKE 'btn:users:force%' 
               OR code LIKE 'btn:backups%'
            ORDER BY code
        `);

        console.log('📋 New button permissions added:');
        result.rows.forEach(r => console.log(`   - ${r.code}: ${r.name}`));

        console.log('\n' + '━'.repeat(60));
        console.log('✅ Complete!\n');

        await pool.end();
    } catch (e) {
        console.error('❌ Error:', e.message);
        await pool.end();
        process.exit(1);
    }
})();
