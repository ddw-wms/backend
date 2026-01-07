require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');

(async () => {
    const API_URL = process.env.API_URL || 'http://localhost:5000';
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // Find a picker user
        const userRes = await pool.query("SELECT id, username FROM users WHERE role='picker' LIMIT 1");
        if (userRes.rows.length === 0) {
            console.log('❌ No picker user found in database');
            process.exit(1);
        }

        const pickerUser = userRes.rows[0];
        console.log(`\n✅ Found picker user: ${pickerUser.username} (ID: ${pickerUser.id})`);

        // Try to login
        console.log(`\n🔐 Testing login...`);
        const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
            username: pickerUser.username,
            password: 'test123' // You may need to adjust this
        }).catch(e => {
            console.log('❌ Login failed:', e.response?.data?.error || e.message);
            return null;
        });

        if (!loginResponse) {
            console.log('\n💡 Try resetting password for picker user first');
            process.exit(1);
        }

        const token = loginResponse.data.token;
        console.log('✅ Login successful');

        // Test permissions API
        console.log(`\n🔍 Testing /api/permissions/my-permissions...`);
        const permResponse = await axios.get(`${API_URL}/api/permissions/my-permissions`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const permissions = permResponse.data.permissions;
        const enabledCount = Object.values(permissions).filter(v => v === true).length;
        console.log(`✅ Permissions loaded: ${enabledCount} enabled`);

        // Test users API
        console.log(`\n🔍 Testing /api/users (should work with view_users permission)...`);
        const usersResponse = await axios.get(`${API_URL}/api/users`, {
            headers: { Authorization: `Bearer ${token}` }
        }).catch(e => {
            console.log('❌ Users API failed:', e.response?.status, e.response?.data?.error || e.message);
            return null;
        });

        if (usersResponse) {
            console.log(`✅ Users API works! Got ${usersResponse.data.length} users`);
        }

        // Test backups API
        console.log(`\n🔍 Testing /api/backups (should work with view_backups permission)...`);
        const backupsResponse = await axios.get(`${API_URL}/api/backups`, {
            headers: { Authorization: `Bearer ${token}` }
        }).catch(e => {
            console.log('❌ Backups API failed:', e.response?.status, e.response?.data?.error || e.message);
            return null;
        });

        if (backupsResponse) {
            console.log(`✅ Backups API works! Got ${backupsResponse.data.length} backups`);
        }

        // Test warehouses API
        console.log(`\n🔍 Testing /api/warehouses...`);
        const warehousesResponse = await axios.get(`${API_URL}/api/warehouses`, {
            headers: { Authorization: `Bearer ${token}` }
        }).catch(e => {
            console.log('❌ Warehouses API failed:', e.response?.status, e.response?.data?.error || e.message);
            return null;
        });

        if (warehousesResponse) {
            console.log(`✅ Warehouses API works! Got ${warehousesResponse.data.length} warehouses`);
        }

        console.log('\n✅ All tests completed!');

    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
})();
