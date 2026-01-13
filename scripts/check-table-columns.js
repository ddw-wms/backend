require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkColumns() {
    try {
        const tables = ['picking', 'qc', 'outbound', 'inbound', 'master_data'];

        for (const table of tables) {
            const result = await pool.query(
                `SELECT column_name FROM information_schema.columns 
         WHERE table_name = $1 
         ORDER BY ordinal_position`,
                [table]
            );
            console.log(`\n${table.toUpperCase()} COLUMNS:`);
            console.log(result.rows.map(r => r.column_name));
        }

        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkColumns();
