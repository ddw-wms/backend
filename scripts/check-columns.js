require('dotenv').config();
const { Pool } = require('pg');

(async () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // Master data columns
        const masterCols = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'master_data' 
            ORDER BY ordinal_position
        `);

        console.log('📋 Master Data Columns:');
        masterCols.rows.forEach(c => console.log(`   - ${c.column_name} (${c.data_type})`));

        // Inbound columns
        const inboundCols = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'inbound' 
            ORDER BY ordinal_position
        `);

        console.log('\n📋 Inbound Columns:');
        inboundCols.rows.forEach(c => console.log(`   - ${c.column_name} (${c.data_type})`));

        // Sample count
        const count = await pool.query(`SELECT COUNT(*) as total FROM master_data`);
        console.log(`\n📊 Total master_data records: ${count.rows[0].total}`);

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
})();
