/**
 * Check missing permissions - compare what's in role_permissions vs permissions table
 */

require('dotenv').config();
const { Pool } = require('pg');

// Parse connection string
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function checkMissingPermissions() {
    try {
        console.log('='.repeat(60));
        console.log('CHECKING MISSING PERMISSIONS');
        console.log('='.repeat(60));

        // Get all permissions from permissions table
        const existingPerms = await pool.query(`
            SELECT code FROM permissions ORDER BY code
        `);
        console.log(`\n1. Total permissions in 'permissions' table: ${existingPerms.rows.length}`);

        const existingCodes = new Set(existingPerms.rows.map(r => r.code));

        // Get all unique permission codes from role_permissions
        const rolePermCodes = await pool.query(`
            SELECT DISTINCT permission_code 
            FROM role_permissions 
            ORDER BY permission_code
        `);
        console.log(`\n2. Total unique permission codes in 'role_permissions': ${rolePermCodes.rows.length}`);

        // Find codes in role_permissions that don't exist in permissions
        const missingInPermissions = [];
        for (const row of rolePermCodes.rows) {
            if (!existingCodes.has(row.permission_code)) {
                missingInPermissions.push(row.permission_code);
            }
        }

        if (missingInPermissions.length > 0) {
            console.log(`\n3. ⚠️  Permission codes in 'role_permissions' but NOT in 'permissions' table:`);
            missingInPermissions.forEach(code => console.log(`   - ${code}`));
        } else {
            console.log('\n3. ✅ All role_permissions codes exist in permissions table');
        }

        // Get permission codes that frontend might send
        console.log('\n4. Sample of existing permissions (first 20):');
        existingPerms.rows.slice(0, 20).forEach(p => console.log(`   - ${p.code}`));

        // Check manager's current enabled permissions
        const managerPerms = await pool.query(`
            SELECT 
                rp.permission_code,
                rp.is_enabled,
                CASE WHEN p.code IS NULL THEN 'MISSING' ELSE 'EXISTS' END as in_permissions_table
            FROM role_permissions rp
            LEFT JOIN permissions p ON p.code = rp.permission_code
            WHERE rp.role_id = 25
            ORDER BY rp.permission_code
        `);

        console.log(`\n5. Manager (role_id=25) permissions status:`);
        console.log(`   Total: ${managerPerms.rows.length}`);

        const missingManager = managerPerms.rows.filter(r => r.in_permissions_table === 'MISSING');
        if (missingManager.length > 0) {
            console.log(`   ⚠️  ${missingManager.length} permission codes are MISSING from permissions table:`);
            missingManager.forEach(r => console.log(`      - ${r.permission_code}`));
        } else {
            console.log('   ✅ All manager permission codes exist in permissions table');
        }

        console.log('\n' + '='.repeat(60));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkMissingPermissions();
