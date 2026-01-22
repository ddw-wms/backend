/**
 * Run migration to add masterdata edit/delete button permissions
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    console.log('='.repeat(60));
    console.log('Adding Master Data Edit/Delete Button Permissions');
    console.log('='.repeat(60));

    try {
        // Step 1: Add new permissions
        console.log('\n1. Adding permissions to permissions table...');
        await pool.query(`
            INSERT INTO permissions (code, name, category, page, parent_code, sort_order)
            VALUES 
                ('btn:masterdata:edit', 'Master Data - Edit Button', 'button', 'settings-masterdata', 'tab:masterdata:list', 850),
                ('btn:masterdata:delete', 'Master Data - Delete Button', 'button', 'settings-masterdata', 'tab:masterdata:list', 851)
            ON CONFLICT (code) DO NOTHING
        `);
        console.log('   ✅ Permissions added');

        // Step 2: Grant to all roles
        console.log('\n2. Granting permissions to all roles...');
        const rolesResult = await pool.query('SELECT id, name FROM roles');

        for (const role of rolesResult.rows) {
            await pool.query(`
                INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
                VALUES 
                    ($1, 'btn:masterdata:edit', true, true),
                    ($1, 'btn:masterdata:delete', true, true)
                ON CONFLICT (role_id, permission_code) DO NOTHING
            `, [role.id]);
            console.log(`   ✅ Granted to role: ${role.name}`);
        }

        // Verify
        console.log('\n3. Verifying...');
        const permsResult = await pool.query(`
            SELECT code, name FROM permissions 
            WHERE code IN ('btn:masterdata:edit', 'btn:masterdata:delete')
        `);
        console.log('   Permissions in database:');
        permsResult.rows.forEach(r => console.log(`      - ${r.code}: ${r.name}`));

        const rolePermsResult = await pool.query(`
            SELECT r.name as role_name, COUNT(*) as perm_count
            FROM role_permissions rp 
            JOIN roles r ON r.id = rp.role_id 
            WHERE rp.permission_code IN ('btn:masterdata:edit', 'btn:masterdata:delete')
            GROUP BY r.name
        `);
        console.log('   Role permissions granted:');
        rolePermsResult.rows.forEach(r => console.log(`      - ${r.role_name}: ${r.perm_count} permissions`));

        console.log('\n' + '='.repeat(60));
        console.log('✅ Migration completed successfully!');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
    } finally {
        await pool.end();
    }
}

runMigration();
