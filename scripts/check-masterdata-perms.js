require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.query("SELECT code, name, page FROM permissions WHERE code LIKE '%masterdata%' ORDER BY code")
    .then(r => {
        console.log('Current MasterData Permissions:');
        r.rows.forEach(row => console.log('  ', row.code, '-', row.name, '(page:', row.page + ')'));
        pool.end();
    })
    .catch(err => {
        console.error('Error:', err);
        pool.end();
    });
