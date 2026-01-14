// Final verification - Show all actual permissions
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set. Please configure .env file.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function verifyPermissions() {
    const client = await pool.connect();

    try {
        console.log('🔍 FINAL VERIFICATION - All Actual UI Permissions\n');
        console.log('='.repeat(70));

        // Total count
        const total = await client.query('SELECT COUNT(*) as count FROM permissions');
        console.log(`\n📊 Total Permissions in Database: ${total.rows[0].count}\n`);

        // Category breakdown
        const categories = await client.query(`
      SELECT category, COUNT(*) as count 
      FROM permissions 
      GROUP BY category 
      ORDER BY category
    `);

        console.log('📁 Permissions by Category:');
        console.table(categories.rows);

        // Picker role verification
        const picker = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE enabled = true) as enabled,
        COUNT(*) FILTER (WHERE enabled = false) as disabled
      FROM role_permissions 
      WHERE role = 'picker'
    `);

        console.log('\n👤 Picker Role Status:');
        console.table(picker.rows);

        // Check for any remaining fake permissions
        console.log('\n🔍 Checking for fake permissions...');

        const fakeChecks = [
            { name: 'Dashboard Analytics Tab', key: 'dashboard_tab_analytics' },
            { name: 'Dashboard Overview Tab', key: 'dashboard_tab_overview' },
            { name: 'Any other dashboard tabs', pattern: 'dashboard_tab_%' }
        ];

        let fakesFound = false;
        for (const check of fakeChecks) {
            const result = await client.query(
                check.pattern
                    ? `SELECT COUNT(*) as count FROM permissions WHERE permission_key LIKE $1`
                    : `SELECT COUNT(*) as count FROM permissions WHERE permission_key = $1`,
                [check.pattern || check.key]
            );

            if (parseInt(result.rows[0].count) > 0) {
                console.log(`❌ FOUND: ${check.name} - Count: ${result.rows[0].count}`);
                fakesFound = true;
            }
        }

        if (!fakesFound) {
            console.log('✅ No fake permissions found! All clean.\n');
        }

        // Show sample of each category
        console.log('📋 Sample Permissions from Each Category:\n');

        const allCategories = categories.rows.map(r => r.category);

        for (const category of allCategories) {
            const sample = await client.query(`
        SELECT permission_key, permission_name 
        FROM permissions 
        WHERE category = $1 
        ORDER BY permission_key 
        LIMIT 5
      `, [category]);

            console.log(`\n📌 ${category.toUpperCase()} (showing 5/${categories.rows.find(r => r.category === category).count}):`);
            sample.rows.forEach(p => {
                console.log(`   • ${p.permission_key} - ${p.permission_name}`);
            });
        }

        console.log('\n' + '='.repeat(70));
        console.log('✅ Verification Complete!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

verifyPermissions();
