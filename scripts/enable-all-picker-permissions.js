require('dotenv').config();
const { Pool } = require('pg');

(async () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('\n🔧 ENABLING ALL PERMISSIONS FOR PICKER ROLE\n');
        console.log('━'.repeat(60));

        // Get all permissions
        const allPerms = await pool.query('SELECT permission_key FROM permissions ORDER BY permission_key');
        console.log(`\n📋 Total permissions in system: ${allPerms.rows.length}`);

        // Check current picker permissions
        const currentPerms = await pool.query(
            "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE enabled=true) as enabled FROM role_permissions WHERE role='picker'"
        );
        console.log(`\n📊 Current picker permissions:`);
        console.log(`   Total: ${currentPerms.rows[0].total}`);
        console.log(`   Enabled: ${currentPerms.rows[0].enabled}`);
        console.log(`   Disabled: ${currentPerms.rows[0].total - currentPerms.rows[0].enabled}`);

        // Enable ALL permissions for picker
        console.log(`\n⚙️  Enabling ALL ${allPerms.rows.length} permissions for picker role...`);

        let updated = 0;
        let inserted = 0;

        for (const perm of allPerms.rows) {
            const result = await pool.query(
                `INSERT INTO role_permissions (role, permission_key, enabled)
                 VALUES ('picker', $1, true)
                 ON CONFLICT (role, permission_key) 
                 DO UPDATE SET enabled = true, updated_at = NOW()
                 RETURNING (xmax = 0) as inserted`,
                [perm.permission_key]
            );

            if (result.rows[0].inserted) {
                inserted++;
            } else {
                updated++;
            }
        }

        console.log(`   ✅ Inserted: ${inserted} new permissions`);
        console.log(`   ✅ Updated: ${updated} existing permissions`);

        // Verify
        const finalPerms = await pool.query(
            "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE enabled=true) as enabled FROM role_permissions WHERE role='picker'"
        );

        console.log(`\n✅ FINAL STATUS:`);
        console.log(`   Total: ${finalPerms.rows[0].total}`);
        console.log(`   Enabled: ${finalPerms.rows[0].enabled}`);
        console.log(`   Disabled: ${finalPerms.rows[0].total - finalPerms.rows[0].enabled}`);

        if (finalPerms.rows[0].enabled == allPerms.rows.length) {
            console.log(`\n🎉 SUCCESS! All ${allPerms.rows.length} permissions are now enabled for picker role!\n`);
        } else {
            console.log(`\n⚠️  Warning: Not all permissions were enabled. Please check manually.\n`);
        }

        console.log('━'.repeat(60));

    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
})();
