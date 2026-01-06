const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixCascadeConstraint() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        console.log('🔧 Fixing QC table CASCADE constraint...\n');

        // Step 1: Drop the existing CASCADE constraint
        console.log('Step 1: Dropping existing CASCADE constraint...');
        await client.query('ALTER TABLE qc DROP CONSTRAINT IF EXISTS qc_inbound_id_fkey');
        console.log('✅ CASCADE constraint dropped\n');

        // Step 2: Add new constraint with SET NULL instead of CASCADE
        console.log('Step 2: Adding new constraint with SET NULL...');
        await client.query(`
      ALTER TABLE qc 
      ADD CONSTRAINT qc_inbound_id_fkey 
      FOREIGN KEY (inbound_id) 
      REFERENCES inbound(id) 
      ON DELETE SET NULL
    `);
        console.log('✅ New constraint added with SET NULL\n');

        // Step 3: Verify the change
        console.log('Step 3: Verifying the change...');
        const result = await client.query(`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conname = 'qc_inbound_id_fkey'
    `);

        console.log('New constraint definition:');
        console.log(JSON.stringify(result.rows, null, 2));

        await client.query('COMMIT');

        console.log('\n✅✅✅ FIX COMPLETED SUCCESSFULLY! ✅✅✅');
        console.log('\nNow when you delete inbound batches:');
        console.log('  - Inbound records will be deleted');
        console.log('  - QC records will NOT be deleted');
        console.log('  - QC records inbound_id will be set to NULL');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

fixCascadeConstraint();
