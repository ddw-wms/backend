const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    try {
        // Check requests
        const requests = await pool.query(`
            SELECT id, request_type, role_id, status, created_at 
            FROM permission_change_requests 
            ORDER BY id DESC LIMIT 5
        `);
        console.log('=== APPROVAL REQUESTS ===');
        console.table(requests.rows);

        // Check details
        const details = await pool.query(`
            SELECT d.id, d.request_id, d.permission_code, d.old_is_enabled, d.new_is_enabled, 
                   d.old_is_visible, d.new_is_visible, d.is_approved, p.name as perm_name
            FROM permission_change_details d 
            JOIN permissions p ON p.code = d.permission_code 
            ORDER BY d.request_id DESC LIMIT 10
        `);
        console.log('\n=== CHANGE DETAILS ===');
        console.table(details.rows);

        // Check role_permissions for the specific permission
        const rolePerms = await pool.query(`
            SELECT rp.role_id, r.name as role_name, rp.permission_code, rp.is_enabled, rp.is_visible
            FROM role_permissions rp 
            JOIN roles r ON r.id = rp.role_id 
            WHERE rp.permission_code = 'btn:inbound:batches:delete'
        `);
        console.log('\n=== CURRENT ROLE PERMISSIONS FOR btn:inbound:batches:delete ===');
        console.table(rolePerms.rows);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

check();
