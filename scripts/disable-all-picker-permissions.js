// Disable all permissions for picker role (for testing)
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

async function disableAll() {
    const client = await pool.connect();

    try {
        console.log('🔄 Disabling ALL permissions for picker role...\n');

        // Get count before
        const before = await client.query(`
      SELECT COUNT(*) as enabled
      FROM role_permissions 
      WHERE role = 'picker' AND enabled = true
    `);

        console.log(`Before: ${before.rows[0].enabled} permissions enabled\n`);

        // Disable all
        await client.query(`
      UPDATE role_permissions 
      SET enabled = false, updated_at = NOW()
      WHERE role = 'picker'
    `);

        // Get count after
        const after = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE enabled = true) as enabled,
        COUNT(*) FILTER (WHERE enabled = false) as disabled
      FROM role_permissions 
      WHERE role = 'picker'
    `);

        console.log('✅ All permissions disabled!\n');
        console.table(after.rows);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

disableAll();
