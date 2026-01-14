require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');

// Check required environment variables
if (!process.env.TEST_PICKER_USERNAME || !process.env.TEST_PICKER_PASSWORD) {
    console.error('❌ TEST_PICKER_USERNAME and TEST_PICKER_PASSWORD must be set');
    console.log('   Usage: TEST_PICKER_USERNAME=xxx TEST_PICKER_PASSWORD=xxx node test-picker-complete.js');
    process.exit(1);
}

(async () => {
    const API_URL = process.env.API_URL || 'http://localhost:5000';

    try {
        console.log('\n🔐 Testing Picker User Login and Permissions\n');
        console.log('━'.repeat(60));

        // Login with picker
        console.log(`\n1️⃣  Attempting login as "${process.env.TEST_PICKER_USERNAME}"...`);
        const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
            username: process.env.TEST_PICKER_USERNAME,
            password: process.env.TEST_PICKER_PASSWORD
        }).catch(e => {
            console.log(`   ❌ Login failed: ${e.response?.data?.error || e.message}`);
            console.log('\n   💡 Try these steps:');
            console.log('      1. Login as admin');
            console.log('      2. Go to Users page');
            console.log('      3. Check user credentials');
            console.log('      4. Then run this test again\n');
            return null;
        });

        if (!loginResponse) {
            process.exit(1);
        }

        const token = loginResponse.data.token;
        const user = loginResponse.data.user;
        console.log(`   ✅ Login successful!`);
        console.log(`   📝 User: ${user.username} (${user.fullName})`);
        console.log(`   🎭 Role: ${user.role}`);

        // Test permissions API
        console.log('\n2️⃣  Fetching permissions...');
        const permResponse = await axios.get(`${API_URL}/api/permissions/my-permissions`, {
            headers: { Authorization: `Bearer ${token}` }
        }).catch(e => {
            console.log(`   ❌ Failed: ${e.response?.data?.error || e.message}`);
            return null;
        });

        if (!permResponse) {
            process.exit(1);
        }

        const permissions = permResponse.data.permissions;
        const enabledCount = Object.values(permissions).filter(v => v === true).length;
        console.log(`   ✅ Loaded ${enabledCount} enabled permissions`);

        // Check specific permissions
        const checkPerms = ['view_users', 'view_backups', 'view_warehouses', 'view_racks'];
        console.log('\n3️⃣  Checking key permissions:');
        checkPerms.forEach(perm => {
            const has = permissions[perm] === true;
            console.log(`   ${has ? '✅' : '❌'} ${perm}: ${has ? 'enabled' : 'NOT enabled'}`);
        });

        // Test APIs
        console.log('\n4️⃣  Testing API endpoints:');

        const tests = [
            { name: 'Users API', url: '/api/users' },
            { name: 'Backups API', url: '/api/backups' },
            { name: 'Warehouses API', url: '/api/warehouses' },
            { name: 'Racks API', url: '/api/racks' }
        ];

        for (const test of tests) {
            const result = await axios.get(`${API_URL}${test.url}`, {
                headers: { Authorization: `Bearer ${token}` }
            }).catch(e => {
                return { error: true, status: e.response?.status, message: e.response?.data?.error || e.message };
            });

            if (result.error) {
                console.log(`   ❌ ${test.name}: Failed (${result.status}) - ${result.message}`);
            } else {
                const dataLength = Array.isArray(result.data) ? result.data.length : 'N/A';
                console.log(`   ✅ ${test.name}: Success (${dataLength} items)`);
            }
        }

        console.log('\n━'.repeat(60));
        console.log('✅ Test Complete!\n');

    } catch (e) {
        console.error('\n❌ Unexpected Error:', e.message);
        process.exit(1);
    }
})();
