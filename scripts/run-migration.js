// Script to run database migrations
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    try {
        console.log('🔌 Connecting to database...');

        const sqlFile = path.join(__dirname, '../database/comprehensive_permissions_table.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');

        console.log('📊 Running migration...');
        await pool.query(sql);

        console.log('✅ Migration completed successfully!');

        // Verify
        const result = await pool.query('SELECT COUNT(*) FROM role_permissions');
        console.log(`📈 Total permissions in database: ${result.rows[0].count}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

runMigration();
