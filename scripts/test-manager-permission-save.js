/**
 * Test script to check if manager permission save is working
 * This will try to toggle a permission for manager role and see if it saves
 */

require('dotenv').config();
const { Pool } = require('pg');

// Parse connection string
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function testPermissionSave() {
    try {
        console.log('='.repeat(60));
        console.log('TESTING MANAGER PERMISSION SAVE');
        console.log('='.repeat(60));

        // Get manager role
        const roleResult = await pool.query(
            `SELECT id, name FROM roles WHERE name = 'manager'`
        );

        if (roleResult.rows.length === 0) {
            console.log('ERROR: Manager role not found');
            return;
        }

        const managerId = roleResult.rows[0].id;
        console.log(`\n1. Manager role ID: ${managerId}`);

        // Get a test permission
        const testPermCode = 'dashboard_view';

        // Check current state
        const currentState = await pool.query(
            `SELECT rp.permission_code, rp.is_enabled, rp.is_visible
             FROM role_permissions rp
             WHERE rp.role_id = $1 AND rp.permission_code = $2`,
            [managerId, testPermCode]
        );

        console.log(`\n2. Current state of '${testPermCode}' for manager:`);
        if (currentState.rows.length === 0) {
            console.log('   No record exists (will be created on insert)');
        } else {
            console.log(`   is_enabled: ${currentState.rows[0].is_enabled}`);
            console.log(`   is_visible: ${currentState.rows[0].is_visible}`);
        }

        // Now test upsert
        const newEnabled = currentState.rows.length > 0 ? !currentState.rows[0].is_enabled : true;
        console.log(`\n3. Testing UPSERT with is_enabled = ${newEnabled}`);

        try {
            const upsertResult = await pool.query(`
                INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
                VALUES ($1, $2, $3, true)
                ON CONFLICT (role_id, permission_code)
                DO UPDATE SET 
                    is_enabled = EXCLUDED.is_enabled, 
                    is_visible = EXCLUDED.is_visible,
                    updated_at = NOW()
                RETURNING *
            `, [managerId, testPermCode, newEnabled]);

            console.log('   UPSERT successful!');
            console.log('   Result:', upsertResult.rows[0]);
        } catch (upsertError) {
            console.log('   UPSERT FAILED:', upsertError.message);
            console.log('   Error details:', upsertError);
        }

        // Verify the change
        const afterState = await pool.query(
            `SELECT rp.permission_code, rp.is_enabled, rp.is_visible
             FROM role_permissions rp
             WHERE rp.role_id = $1 AND rp.permission_code = $2`,
            [managerId, testPermCode]
        );

        console.log(`\n4. After UPSERT state:`);
        if (afterState.rows.length > 0) {
            console.log(`   is_enabled: ${afterState.rows[0].is_enabled}`);
            console.log(`   is_visible: ${afterState.rows[0].is_visible}`);
        } else {
            console.log('   No record (something went wrong)');
        }

        // Revert the change
        console.log('\n5. Reverting change...');
        await pool.query(`
            INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
            VALUES ($1, $2, $3, true)
            ON CONFLICT (role_id, permission_code)
            DO UPDATE SET 
                is_enabled = EXCLUDED.is_enabled, 
                is_visible = EXCLUDED.is_visible,
                updated_at = NOW()
        `, [managerId, testPermCode, currentState.rows.length > 0 ? currentState.rows[0].is_enabled : false]);
        console.log('   Reverted to original state');

        // Check role_permissions table structure
        console.log('\n6. Checking role_permissions table constraints:');
        const constraints = await pool.query(`
            SELECT 
                tc.constraint_name, 
                tc.constraint_type,
                kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'role_permissions'
        `);
        console.log('   Constraints:');
        constraints.rows.forEach(c => {
            console.log(`   - ${c.constraint_name} (${c.constraint_type}): ${c.column_name}`);
        });

        console.log('\n' + '='.repeat(60));
        console.log('TEST COMPLETE');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

testPermissionSave();
