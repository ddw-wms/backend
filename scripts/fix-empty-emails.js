// Script to fix empty email strings in users table
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixEmptyEmails() {
    try {
        // Update empty string emails to NULL
        const result = await pool.query(
            "UPDATE users SET email = NULL WHERE email = ''"
        );
        console.log('Fixed', result.rowCount, 'users with empty emails');

        // Also check for any duplicate emails
        const duplicates = await pool.query(`
      SELECT email, COUNT(*) as count 
      FROM users 
      WHERE email IS NOT NULL AND email != ''
      GROUP BY email 
      HAVING COUNT(*) > 1
    `);

        if (duplicates.rows.length > 0) {
            console.log('Warning: Found duplicate emails:', duplicates.rows);
        } else {
            console.log('No duplicate emails found');
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

fixEmptyEmails();
