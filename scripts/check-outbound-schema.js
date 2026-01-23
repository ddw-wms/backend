// Check outbound table schema and triggers
require('dotenv').config();
const { Pool } = require('pg');

(async () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // Get columns
        console.log('\n=== OUTBOUND TABLE COLUMNS ===');
        const columns = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'outbound' 
            ORDER BY ordinal_position
        `);
        console.table(columns.rows);

        // Check triggers on outbound table
        console.log('\n=== TRIGGERS ON OUTBOUND TABLE ===');
        const triggers = await pool.query(`
            SELECT tgname AS trigger_name, 
                   pg_get_triggerdef(oid) AS trigger_definition
            FROM pg_trigger 
            WHERE tgrelid = 'outbound'::regclass
        `);
        console.log('Triggers found:', triggers.rows.length);
        triggers.rows.forEach(t => {
            console.log('\nTrigger:', t.trigger_name);
            console.log('Definition:', t.trigger_definition);
        });

        // Check if there's a generic update_timestamp function
        console.log('\n=== UPDATE TIMESTAMP FUNCTIONS ===');
        const functions = await pool.query(`
            SELECT proname, prosrc 
            FROM pg_proc 
            WHERE proname LIKE '%update%timestamp%' OR proname LIKE '%set%updated%'
        `);
        functions.rows.forEach(f => {
            console.log('\nFunction:', f.proname);
            console.log('Source:', f.prosrc);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
})();
