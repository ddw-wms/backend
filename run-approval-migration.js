// Run Permission Approval System Migration
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        console.log('Running permission approval system migration...');

        const migrationPath = path.join(__dirname, 'migrations', 'create_permission_approval_system.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await pool.query(sql);

        console.log('✅ Migration completed successfully!');

        // Verify tables were created
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('permission_change_requests', 'permission_change_details')
        `);

        console.log('Created tables:', tables.rows.map(r => r.table_name));

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

runMigration().catch(console.error);
