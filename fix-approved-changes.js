// Fix already approved but not applied changes
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixApprovedChanges() {
    try {
        console.log('Fixing approved but not applied changes...\n');

        // Find all approved changes from pending requests
        const approvedChanges = await pool.query(`
            SELECT d.*, r.role_id, r.target_user_id, r.request_type
            FROM permission_change_details d
            JOIN permission_change_requests r ON r.id = d.request_id
            WHERE d.is_approved = true AND r.status = 'pending'
        `);

        console.log(`Found ${approvedChanges.rows.length} approved changes to apply\n`);

        for (const change of approvedChanges.rows) {
            if (change.request_type === 'role') {
                // Apply to role_permissions
                await pool.query(`
                    INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (role_id, permission_code)
                    DO UPDATE SET 
                        is_enabled = $3,
                        is_visible = $4,
                        updated_at = NOW()
                `, [change.role_id, change.permission_code, change.new_is_enabled, change.new_is_visible]);

                console.log(`✅ Applied: ${change.permission_code} for role_id ${change.role_id}`);
                console.log(`   is_enabled: ${change.new_is_enabled}, is_visible: ${change.new_is_visible}`);
            }
        }

        // Now update request status for those with all changes reviewed
        const requestsToFinalize = await pool.query(`
            SELECT r.id, r.request_type,
                COUNT(*) FILTER (WHERE d.is_approved = true) as approved,
                COUNT(*) FILTER (WHERE d.is_approved = false) as rejected,
                COUNT(*) FILTER (WHERE d.is_approved IS NULL) as pending
            FROM permission_change_requests r
            JOIN permission_change_details d ON d.request_id = r.id
            WHERE r.status = 'pending'
            GROUP BY r.id, r.request_type
            HAVING COUNT(*) FILTER (WHERE d.is_approved IS NULL) = 0
        `);

        for (const req of requestsToFinalize.rows) {
            let status = 'approved';
            if (parseInt(req.approved) === 0) status = 'rejected';
            else if (parseInt(req.rejected) > 0) status = 'partially_approved';

            await pool.query(`
                UPDATE permission_change_requests
                SET status = $1, reviewed_at = NOW()
                WHERE id = $2
            `, [status, req.id]);

            console.log(`\n📋 Request #${req.id} finalized as: ${status}`);
        }

        console.log('\n✅ Fix complete!');

        // Verify
        const verify = await pool.query(`
            SELECT rp.role_id, r.name as role_name, rp.permission_code, rp.is_enabled, rp.is_visible
            FROM role_permissions rp 
            JOIN roles r ON r.id = rp.role_id 
            WHERE rp.permission_code = 'btn:inbound:batches:delete' AND r.name = 'admin'
        `);
        console.log('\n=== VERIFICATION: admin role btn:inbound:batches:delete ===');
        console.table(verify.rows);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

fixApprovedChanges();
