require('dotenv').config();
const { Pool } = require('pg');

(async () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // Check permissions table structure
        const columns = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'permissions'
            ORDER BY ordinal_position
        `);

        console.log('📋 Permissions table columns:');
        columns.rows.forEach(c => console.log(`   - ${c.column_name} (${c.data_type})`));

        // Check role_permissions table structure
        const rolePermCols = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'role_permissions'
            ORDER BY ordinal_position
        `);

        console.log('\n📋 Role_permissions table columns:');
        rolePermCols.rows.forEach(c => console.log(`   - ${c.column_name} (${c.data_type})`));

        // Sample data
        const sample = await pool.query('SELECT * FROM permissions LIMIT 3');
        console.log('\n📋 Sample permissions:');
        console.log(sample.rows);

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
})();
