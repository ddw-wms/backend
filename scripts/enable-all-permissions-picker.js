// Enable ALL permissions for picker role
const { Pool } = require('pg');

const pool = new Pool({
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.oycqwsvjmiyfwrmzncso',
    password: 'Sunita_01639',
    ssl: { rejectUnauthorized: false }
});

async function enableAll() {
    const client = await pool.connect();

    try {
        console.log('🔄 Enabling ALL 265 permissions for picker...\n');

        await client.query(`
      INSERT INTO role_permissions (role, permission_key, enabled)
      SELECT 'picker', permission_key, true
      FROM permissions
      ON CONFLICT (role, permission_key) 
      DO UPDATE SET enabled = true, updated_at = NOW()
    `);

        console.log('✅ Done!\n');

        // Summary
        const summary = await client.query(`
      SELECT 
        p.category,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE rp.enabled = true) as enabled
      FROM permissions p
      LEFT JOIN role_permissions rp ON p.permission_key = rp.permission_key AND rp.role = 'picker'
      GROUP BY p.category
      ORDER BY p.category
    `);

        console.table(summary.rows);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

enableAll();
