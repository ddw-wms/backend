// File Path = wms_backend/scripts/toggle-picker-permissions.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set. Please configure .env file.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function togglePickerPermissions(enable = false) {
    try {
        console.log(`\n${enable ? '✅ ENABLING' : '❌ DISABLING'} all picker permissions...\n`);

        const result = await pool.query(
            `UPDATE role_permissions 
             SET enabled = $1, updated_at = NOW() 
             WHERE role = 'picker'
             RETURNING permission_key`,
            [enable]
        );

        console.log(`✓ ${result.rowCount} permissions ${enable ? 'enabled' : 'disabled'} for picker role\n`);

        // Check status
        const status = await pool.query(
            `SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE enabled = true) as enabled,
                COUNT(*) FILTER (WHERE enabled = false) as disabled
             FROM role_permissions 
             WHERE role = 'picker'`
        );

        console.log('Current Status:');
        console.log(`  Total: ${status.rows[0].total}`);
        console.log(`  Enabled: ${status.rows[0].enabled}`);
        console.log(`  Disabled: ${status.rows[0].disabled}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

// Get command line argument
const action = process.argv[2];

if (action === 'enable') {
    togglePickerPermissions(true);
} else if (action === 'disable') {
    togglePickerPermissions(false);
} else {
    console.log('Usage: node toggle-picker-permissions.js [enable|disable]');
    process.exit(1);
}
