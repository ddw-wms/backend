// Script to run actual UI permissions migration
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.oycqwsvjmiyfwrmzncso',
    password: 'Sunita_01639',
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('🚀 Running actual UI permissions migration...\n');

        // Read SQL file
        const sqlPath = path.join(__dirname, '../migrations/add_actual_ui_permissions.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Execute migration
        await client.query(sql);

        console.log('✅ Migration completed successfully!\n');

        // Show summary
        const result = await client.query(`
      SELECT category, COUNT(*) as count 
      FROM permissions 
      WHERE category IN ('dashboard', 'inbound', 'picking', 'qc', 'outbound')
      GROUP BY category 
      ORDER BY category
    `);

        console.log('📊 Permissions Summary:');
        console.table(result.rows);

        // Check specific permissions
        console.log('\n✅ Dashboard Permissions:');
        const dashboard = await client.query(`
      SELECT permission_key, permission_name 
      FROM permissions 
      WHERE category = 'dashboard' 
      ORDER BY permission_key
    `);
        console.table(dashboard.rows);

        console.log('\n✅ Inbound Permissions:');
        const inbound = await client.query(`
      SELECT permission_key, permission_name 
      FROM permissions 
      WHERE category = 'inbound' 
      ORDER BY permission_key
    `);
        console.table(inbound.rows);

    } catch (error) {
        console.error('❌ Error running migration:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
