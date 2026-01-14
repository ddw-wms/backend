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

async function checkDashboardPermissions() {
    try {
        console.log('\n=== DASHBOARD PERMISSIONS ===\n');

        const result = await pool.query(`
            SELECT permission_key, permission_name, category, description 
            FROM permissions 
            WHERE category = 'dashboard' 
            ORDER BY permission_name
        `);

        console.log(`Total Dashboard Permissions: ${result.rows.length}\n`);

        result.rows.forEach((perm, index) => {
            console.log(`${index + 1}. ${perm.permission_name}`);
            console.log(`   Key: ${perm.permission_key}`);
            console.log(`   Description: ${perm.description}`);
            console.log('');
        });

        // Check for duplicates
        const keys = result.rows.map(r => r.permission_key);
        const duplicates = keys.filter((item, index) => keys.indexOf(item) !== index);

        if (duplicates.length > 0) {
            console.log('\n❌ DUPLICATES FOUND:');
            duplicates.forEach(dup => console.log(`   - ${dup}`));
        } else {
            console.log('\n✅ No duplicates found');
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkDashboardPermissions();
