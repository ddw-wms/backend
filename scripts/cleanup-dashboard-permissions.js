const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'wms',
    user: 'postgres',
    password: 'root',
});

async function cleanupDashboardPermissions() {
    try {
        console.log('\n=== CLEANING UP DASHBOARD PERMISSIONS ===\n');

        // List of valid dashboard permissions that are actually used in code
        const validPermissions = [
            'view_dashboard',
            'view_dashboard_stats',
            'view_dashboard_charts',
            'export_dashboard',
            'dashboard_filter_warehouse',
            'refresh_dashboard'
        ];

        // Get all current dashboard permissions
        const current = await pool.query(`
            SELECT permission_key, permission_name 
            FROM permissions 
            WHERE category = 'dashboard' 
            ORDER BY permission_key
        `);

        console.log(`Current dashboard permissions: ${current.rows.length}\n`);
        current.rows.forEach(p => {
            const isValid = validPermissions.includes(p.permission_key);
            console.log(`${isValid ? '✅' : '❌'} ${p.permission_key} - ${p.permission_name}`);
        });

        // Find invalid permissions to delete
        const invalidKeys = current.rows
            .filter(p => !validPermissions.includes(p.permission_key))
            .map(p => p.permission_key);

        if (invalidKeys.length > 0) {
            console.log(`\n⚠️  Found ${invalidKeys.length} invalid permissions to remove:\n`);
            invalidKeys.forEach(key => console.log(`   - ${key}`));

            // Delete invalid permissions
            const deleteResult = await pool.query(`
                DELETE FROM permissions 
                WHERE category = 'dashboard' 
                AND permission_key = ANY($1::text[])
            `, [invalidKeys]);

            console.log(`\n✅ Deleted ${deleteResult.rowCount} invalid dashboard permissions`);

            // Also delete from role_permissions
            const deleteRolePerms = await pool.query(`
                DELETE FROM role_permissions 
                WHERE permission_key = ANY($1::text[])
            `, [invalidKeys]);

            console.log(`✅ Deleted ${deleteRolePerms.rowCount} role permission assignments`);
        } else {
            console.log('\n✅ No invalid permissions found');
        }

        // Add any missing valid permissions
        const missingPermissions = [
            ['view_dashboard', 'View Dashboard Page', 'Access to dashboard page'],
            ['view_dashboard_stats', 'View Dashboard Statistics', 'View statistics and KPIs'],
            ['view_dashboard_charts', 'View Dashboard Charts', 'View charts and graphs'],
            ['export_dashboard', 'Export Dashboard Data', 'Export dashboard data'],
            ['dashboard_filter_warehouse', 'Dashboard Warehouse Filter', 'Use warehouse filter'],
            ['refresh_dashboard', 'Dashboard Refresh Button', 'Use refresh button']
        ];

        let added = 0;
        for (const [key, name, desc] of missingPermissions) {
            const exists = current.rows.find(p => p.permission_key === key);
            if (!exists) {
                await pool.query(`
                    INSERT INTO permissions (permission_key, permission_name, category, description)
                    VALUES ($1, $2, 'dashboard', $3)
                `, [key, name, desc]);
                console.log(`✅ Added missing permission: ${key}`);
                added++;
            }
        }

        if (added > 0) {
            console.log(`\n✅ Added ${added} missing permissions`);
        }

        console.log('\n=== CLEANUP COMPLETE ===\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

cleanupDashboardPermissions();
