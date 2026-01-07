// Enable all actual UI permissions for picker role
const { Pool } = require('pg');

const pool = new Pool({
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.oycqwsvjmiyfwrmzncso',
    password: 'Sunita_01639',
    ssl: { rejectUnauthorized: false }
});

async function enablePermissions() {
    const client = await pool.connect();

    try {
        console.log('🔄 Enabling all permissions for picker role...\n');

        // Get all permissions
        const allPerms = await client.query('SELECT permission_key FROM permissions');
        console.log(`📊 Total permissions in database: ${allPerms.rows.length}\n`);

        // Enable all for picker
        await client.query(`
      INSERT INTO role_permissions (role, permission_key, enabled)
      SELECT 'picker', permission_key, true
      FROM permissions
      ON CONFLICT (role, permission_key) 
      DO UPDATE SET enabled = true
    `);

        console.log('✅ All permissions enabled for picker role!\n');

        // Verify
        const pickerPerms = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE enabled = true) as enabled,
        COUNT(*) FILTER (WHERE enabled = false) as disabled
      FROM role_permissions 
      WHERE role = 'picker'
    `);

        console.log('📊 Picker Role Permissions:');
        console.table(pickerPerms.rows);

        // Show category breakdown
        const breakdown = await client.query(`
      SELECT 
        p.category,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE rp.enabled = true) as enabled
      FROM permissions p
      LEFT JOIN role_permissions rp ON p.permission_key = rp.permission_key AND rp.role = 'picker'
      WHERE p.category IN ('dashboard', 'inbound', 'picking', 'qc', 'outbound')
      GROUP BY p.category
      ORDER BY p.category
    `);

        console.log('\n📊 Category Breakdown:');
        console.table(breakdown.rows);

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

enablePermissions();
