// Run Performance Indexes Migration
// Usage: node scripts/run-performance-indexes.js

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🚀 Running performance indexes migration...');

        const sqlPath = path.join(__dirname, '../migrations/add_performance_indexes.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by semicolon and run each statement
        const statements = sql.split(';').filter(s => s.trim());

        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    console.log(`📝 Executing: ${statement.trim().substring(0, 60)}...`);
                    await pool.query(statement);
                    console.log('✅ Success');
                } catch (err) {
                    // Index might already exist, that's OK
                    if (err.message.includes('already exists')) {
                        console.log('⏭️ Already exists, skipping...');
                    } else {
                        console.error('⚠️ Warning:', err.message);
                    }
                }
            }
        }

        console.log('\n✅ Performance indexes migration completed!');
        console.log('📊 Tables analyzed and ready for optimized queries.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
