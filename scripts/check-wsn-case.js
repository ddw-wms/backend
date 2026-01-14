require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkWSNCase() {
    // Sample WSNs
    const r1 = await pool.query('SELECT wsn FROM inbound WHERE warehouse_id=1 LIMIT 5');
    console.log('INBOUND WSNs:', r1.rows.map(r => r.wsn));

    const r2 = await pool.query('SELECT wsn FROM master_data LIMIT 5');
    console.log('MASTER WSNs:', r2.rows.map(r => r.wsn));

    // Count mismatches
    const mismatch = await pool.query(`
    SELECT COUNT(*) FROM inbound i 
    WHERE i.warehouse_id=1 
    AND NOT EXISTS (SELECT 1 FROM master_data m WHERE m.wsn = i.wsn)
  `);
    console.log('Inbound without exact match:', mismatch.rows[0].count);

    const upperMatch = await pool.query(`
    SELECT COUNT(*) FROM inbound i 
    WHERE i.warehouse_id=1 
    AND NOT EXISTS (SELECT 1 FROM master_data m WHERE UPPER(m.wsn) = UPPER(i.wsn))
  `);
    console.log('Inbound without UPPER match:', upperMatch.rows[0].count);

    // Check if there are any case differences
    const caseDiff = await pool.query(`
    SELECT COUNT(*) FROM inbound i
    JOIN master_data m ON UPPER(i.wsn) = UPPER(m.wsn)
    WHERE i.warehouse_id = 1 AND i.wsn != m.wsn
  `);
    console.log('Rows with case differences:', caseDiff.rows[0].count);

    await pool.end();
}

checkWSNCase().catch(console.error);
