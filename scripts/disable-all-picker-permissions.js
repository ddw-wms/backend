// Disable all permissions for picker role (for testing)
const { Pool } = require('pg');

const pool = new Pool({
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.oycqwsvjmiyfwrmzncso',
    password: 'Sunita_01639',
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
