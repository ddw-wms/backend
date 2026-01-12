require('dotenv').config();
const axios = require('axios');

async function testPermissions() {
    try {
        const base = 'http://localhost:5000/api';

        console.log('🔐 Testing Permissions API on', base);

        const loginResponse = await axios.post(`${base}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });

        const token = loginResponse.data.token;
        const user = loginResponse.data.user;
        console.log(`✅ Logged in as: ${user.username} (${user.role})`);

        const permResponse = await axios.get(`${base}/permissions/my-permissions`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('✅ Permissions fetched:', Object.keys(permResponse.data.permissions).length, 'keys');
        const permissions = permResponse.data.permissions;
        const enabledCount = Object.values(permissions).filter(v => v === true).length;
        console.log(`   Enabled: ${enabledCount}`);

        const sample = Object.entries(permissions).slice(0, 20);
        sample.forEach(([k, v]) => console.log(`   ${v ? '✅' : '❌'} ${k}`));

    } catch (err) {
        console.error('❌ Error during test:', err.response?.data || err.message);
        if (err.response) console.error('   Status:', err.response.status);
    }
}

testPermissions();