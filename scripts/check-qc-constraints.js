const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkConstraints() {
    try {
        // Check QC table foreign key constraints
        const qcConstraints = await pool.query(`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'qc'::regclass AND contype = 'f'
    `);

        console.log('=== QC Table Foreign Key Constraints ===');
        console.log(JSON.stringify(qcConstraints.rows, null, 2));

        // Check if inbound_id column exists in QC table
        const qcColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'qc' AND column_name LIKE '%inbound%'
    `);

        console.log('\n=== QC Table Inbound-related Columns ===');
        console.log(JSON.stringify(qcColumns.rows, null, 2));

        await pool.end();
    } catch (error) {
        console.error('Error:', error);
        await pool.end();
    }
}

checkConstraints();
