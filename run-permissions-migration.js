// Run permissions migration
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/wms'
});

async function runMigration() {
    try {
        console.log('🔄 Running permissions system migration...');

        const migrationPath = path.join(__dirname, 'migrations', 'create_permissions_system.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await pool.query(sql);

        console.log('✅ Permissions system migration completed successfully!');

        // Verify tables were created
        const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('permissions', 'role_permissions', 'user_permissions')
      ORDER BY table_name
    `);

        console.log('\n📋 Tables created:');
        result.rows.forEach(row => console.log(`  ✓ ${row.table_name}`));

        // Check permission count
        const permCount = await pool.query('SELECT COUNT(*) as count FROM permissions');
        console.log(`\n🔐 Total permissions inserted: ${permCount.rows[0].count}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

runMigration();
