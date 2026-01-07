// Check customers and backups permissions in database
const { Pool } = require('pg');

const pool = new Pool({
    host: 'aws-1-ap-south-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.oycqwsvjmiyfwrmzncso',
    password: 'Sunita_01639',
    ssl: { rejectUnauthorized: false }
});

async function checkPermissions() {
    const client = await pool.connect();

    try {
        console.log('🔍 Checking Customers and Backups permissions...\n');

        // Check customers permissions
        const customers = await client.query(`
      SELECT permission_key, permission_name, category, description
      FROM permissions 
      WHERE category = 'customers'
      ORDER BY permission_key
    `);

        console.log('📊 CUSTOMERS Permissions:');
        if (customers.rows.length > 0) {
            console.table(customers.rows);
        } else {
            console.log('❌ NO CUSTOMERS PERMISSIONS FOUND!\n');
        }

        // Check backups permissions
        const backups = await client.query(`
      SELECT permission_key, permission_name, category, description
      FROM permissions 
      WHERE category = 'backups'
      ORDER BY permission_key
    `);

        console.log('\n📊 BACKUPS Permissions:');
        if (backups.rows.length > 0) {
            console.table(backups.rows);
        } else {
            console.log('❌ NO BACKUPS PERMISSIONS FOUND!\n');
        }

        // Check picker role permissions for customers
        const pickerCustomers = await client.query(`
      SELECT rp.permission_key, rp.enabled, p.permission_name
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_key = p.permission_key
      WHERE rp.role = 'picker' AND p.category = 'customers'
      ORDER BY rp.permission_key
    `);

        console.log('\n👤 Picker Role - CUSTOMERS Permissions:');
        if (pickerCustomers.rows.length > 0) {
            console.table(pickerCustomers.rows);
        } else {
            console.log('❌ NO CUSTOMERS PERMISSIONS FOR PICKER!\n');
        }

        // Check picker role permissions for backups
        const pickerBackups = await client.query(`
      SELECT rp.permission_key, rp.enabled, p.permission_name
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_key = p.permission_key
      WHERE rp.role = 'picker' AND p.category = 'backups'
      ORDER BY rp.permission_key
    `);

        console.log('\n👤 Picker Role - BACKUPS Permissions:');
        if (pickerBackups.rows.length > 0) {
            console.table(pickerBackups.rows);
        } else {
            console.log('❌ NO BACKUPS PERMISSIONS FOR PICKER!\n');
        }

        // Check all categories
        const allCategories = await client.query(`
      SELECT category, COUNT(*) as count
      FROM permissions
      GROUP BY category
      ORDER BY category
    `);

        console.log('\n📁 All Categories in Database:');
        console.table(allCategories.rows);

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

checkPermissions();
