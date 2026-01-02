require('dotenv').config();
import db from '../src/config/database';
(async () => {
    try {
        const pool = await db.initializeDatabase();
        // Test QC.BY coalesce
        const res = await pool.query("SELECT COALESCE(qc_by, 'N/A') as qc_by_test FROM qc LIMIT 5");
        console.log('qc_by test rows:', res.rows);

        const res2 = await pool.query("SELECT COALESCE(qc_by::TEXT, 'N/A') as qc_by_test2 FROM qc LIMIT 5");
        console.log('qc_by::text test rows:', res2.rows);

        const res3 = await pool.query("SELECT COALESCE(batch_id, 'SINGLE') as batch_test FROM inbound LIMIT 5");
        console.log('batch_id test rows:', res3.rows);

        const res4 = await pool.query("SELECT COALESCE(batch_id::TEXT, 'SINGLE') as batch_test2 FROM inbound LIMIT 5");
        console.log('batch_id::text test rows:', res4.rows);

        process.exit(0);
    } catch (err) {
        console.error('script error:', err);
        process.exit(1);
    }
})();