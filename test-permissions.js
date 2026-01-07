// Test permissions API
require('dotenv').config();
const axios = require('axios');

async function testPermissions() {
    try {
        console.log('🔐 Testing Permissions API...\n');

        // First login to get token
        console.log('1️⃣ Logging in...');
        const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });

        const token = loginResponse.data.token;
        const user = loginResponse.data.user;
        console.log(`✅ Logged in as: ${user.username} (${user.role})\n`);

        // Test my-permissions endpoint
        console.log('2️⃣ Fetching user permissions...');
        const permResponse = await axios.get('http://localhost:3000/api/permissions/my-permissions', {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log(`✅ Permissions fetched successfully!`);
        console.log(`   User ID: ${permResponse.data.userId}`);
        console.log(`   Role: ${permResponse.data.role}`);

        const permissions = permResponse.data.permissions;
        const enabledCount = Object.values(permissions).filter(v => v === true).length;
        const totalCount = Object.keys(permissions).length;

        console.log(`   Total permissions: ${totalCount}`);
        console.log(`   Enabled: ${enabledCount}`);
        console.log(`   Disabled: ${totalCount - enabledCount}\n`);

        // Show sample permissions
        console.log('3️⃣ Sample permissions:');
        const samplePerms = Object.entries(permissions).slice(0, 10);
        samplePerms.forEach(([key, value]) => {
            console.log(`   ${value ? '✅' : '❌'} ${key}`);
        });

        console.log('\n✅ Permissions system is working correctly!');

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
    }
}

testPermissions();
