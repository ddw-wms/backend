// Run migration for remaining pages permissions
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set. Please configure .env file.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('🚀 Running remaining pages permissions migration...\n');

        // Read SQL file
        const sqlPath = path.join(__dirname, '../migrations/add_remaining_actual_permissions.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Execute migration
        await client.query(sql);

        console.log('✅ Migration completed successfully!\n');

        // Show category summary
        const categorySummary = await client.query(`
      SELECT category, COUNT(*) as permission_count 
      FROM permissions 
      GROUP BY category 
      ORDER BY category
    `);

        console.log('📊 All Categories Summary:');
        console.table(categorySummary.rows);

        // Show new permissions for each category
        const categories = ['customers', 'reports', 'warehouses', 'racks', 'users', 'backups', 'printers', 'master-data'];

        for (const category of categories) {
            const perms = await client.query(`
        SELECT permission_key, permission_name 
        FROM permissions 
        WHERE category = $1 
        ORDER BY permission_key
      `, [category]);

            if (perms.rows.length > 0) {
                console.log(`\n✅ ${category.toUpperCase()} Permissions:`);
                console.table(perms.rows);
            }
        }

    } catch (error) {
        console.error('❌ Error running migration:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
