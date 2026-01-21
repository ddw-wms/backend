// Run migration to add selected_tables column to backup_schedules
// Run with: node scripts/run-selected-tables-migration.js

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
        console.log('🚀 Adding selected_tables column to backup_schedules...\n');

        // Read migration file
        const migrationPath = path.join(__dirname, '..', 'migrations', 'add_selected_tables_to_schedules.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('📝 Running migration...');
        await client.query(sql);

        console.log('\n✅ Migration completed successfully!');

        // Verify column was added
        const result = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'backup_schedules' AND column_name = 'selected_tables'
        `);

        if (result.rows.length > 0) {
            console.log('✅ Column verified:', result.rows[0]);
        } else {
            console.log('⚠️ Column not found - may already exist or migration failed');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(console.error);
