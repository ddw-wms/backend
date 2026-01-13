// Run Complete WMS Performance Migration
// Run with: node scripts/run-inbound-optimization.js

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('🚀 Starting Complete WMS Performance Optimization...\n');

        // Read migration file
        const migrationPath = path.join(__dirname, '..', 'migrations', 'optimize_inbound_performance.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('📝 Running migration (this may take a minute for large tables)...');
        await client.query(sql);

        console.log('\n✅ Migration completed successfully!');

        // Show index status for ALL tables
        console.log('\n📊 Checking created indexes...');
        const indexCheck = await client.query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE tablename IN ('inbound', 'master_data', 'qc', 'picking', 'outbound') 
      AND schemaname = 'public'
      ORDER BY tablename, indexname
    `);

        console.log('\n📋 Active indexes:');
        let currentTable = '';
        indexCheck.rows.forEach(row => {
            if (row.tablename !== currentTable) {
                currentTable = row.tablename;
                console.log(`\n  📁 ${currentTable}:`);
            }
            console.log(`     ✓ ${row.indexname}`);
        });

        // Show table statistics
        console.log('\n\n📈 Table statistics:');
        const stats = await client.query(`
      SELECT 
        relname as table_name,
        n_live_tup as row_count
      FROM pg_stat_user_tables 
      WHERE relname IN ('inbound', 'master_data', 'qc', 'picking', 'outbound')
      ORDER BY n_live_tup DESC
    `);

        stats.rows.forEach(row => {
            console.log(`  ${row.table_name}: ~${Number(row.row_count).toLocaleString()} rows`);
        });

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration()
    .then(() => {
        console.log('\n🎉 Complete WMS Optimization Done! Restart the server to apply changes.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration error:', err);
        process.exit(1);
    });
