/**
 * Script to set default view-only permissions for existing roles
 * View-only: All permissions are visible, only menu permissions are enabled
 * Run this to initialize roles that don't have permissions yet
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('neon.tech')
        ? { rejectUnauthorized: false }
        : undefined
});

async function setDefaultViewOnlyPermissions() {
    const client = await pool.connect();

    try {
        console.log('🔧 Setting default view-only permissions for roles...\n');

        // Get all non-super_admin roles
        const rolesResult = await client.query(`
            SELECT id, name FROM roles WHERE name != 'super_admin'
        `);

        console.log(`Found ${rolesResult.rows.length} roles to process\n`);

        for (const role of rolesResult.rows) {
            console.log(`\n📋 Processing role: ${role.name} (ID: ${role.id})`);

            // Check how many permissions this role has
            const existingCount = await client.query(`
                SELECT COUNT(*) as count FROM role_permissions WHERE role_id = $1
            `, [role.id]);

            // Get total permission count
            const totalPermsResult = await client.query(`
                SELECT COUNT(*) as count FROM permissions
            `);
            const totalPerms = parseInt(totalPermsResult.rows[0].count);

            const existingPermsCount = parseInt(existingCount.rows[0].count);
            console.log(`   - Current permissions: ${existingPermsCount}/${totalPerms}`);

            // Insert default view-only permissions for missing permissions
            const insertResult = await client.query(`
                INSERT INTO role_permissions (role_id, permission_code, is_enabled, is_visible)
                SELECT $1, p.code, 
                       CASE WHEN p.code LIKE 'menu:%' THEN true ELSE false END as is_enabled,
                       true as is_visible
                FROM permissions p
                WHERE NOT EXISTS (
                    SELECT 1 FROM role_permissions rp 
                    WHERE rp.role_id = $1 AND rp.permission_code = p.code
                )
                RETURNING permission_code
            `, [role.id]);

            if (insertResult.rows.length > 0) {
                console.log(`   ✅ Added ${insertResult.rows.length} new permissions with view-only defaults`);

                // Show breakdown
                const menuPerms = insertResult.rows.filter(r => r.permission_code.startsWith('menu:')).length;
                const otherPerms = insertResult.rows.length - menuPerms;
                console.log(`      - Menu permissions (enabled & visible): ${menuPerms}`);
                console.log(`      - Other permissions (visible only): ${otherPerms}`);
            } else {
                console.log(`   ℹ️  All permissions already set for this role`);
            }
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('✅ Default view-only permissions setup complete!');
        console.log('='.repeat(60));
        console.log('\n📝 View-only means:');
        console.log('   - All permissions are VISIBLE in the UI');
        console.log('   - Only MENU permissions are ENABLED (can navigate)');
        console.log('   - Button/Tab/Action permissions are DISABLED by default');
        console.log('\n💡 Admins can adjust individual permissions in the Permissions page');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

setDefaultViewOnlyPermissions()
    .then(() => {
        console.log('\n🎉 Script completed successfully!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n💥 Script failed:', err.message);
        process.exit(1);
    });
