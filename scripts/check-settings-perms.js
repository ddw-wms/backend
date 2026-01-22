require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.query("SELECT code, name FROM permissions WHERE code LIKE 'menu:settings%' ORDER BY code")
    .then(r => {
        console.log('Settings Menu Permissions:');
        r.rows.forEach(row => console.log('  ', row.code, '-', row.name));
        return pool.query("SELECT permission_code, is_enabled FROM role_permissions WHERE role_id = 25 AND permission_code LIKE 'menu:settings%'");
    })
    .then(r => {
        console.log('\nManager (role 25) Settings Permissions:');
        r.rows.forEach(row => console.log('  ', row.permission_code, '- enabled:', row.is_enabled));
        pool.end();
    })
    .catch(err => {
        console.error('Error:', err);
        pool.end();
    });
