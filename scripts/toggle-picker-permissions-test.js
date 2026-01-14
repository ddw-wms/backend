require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');
const jwt = require('jsonwebtoken');

const API = process.env.API_URL || 'http://localhost:5000/api';

// IMPORTANT: Set these environment variables before running
if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    console.error('❌ ADMIN_USERNAME and ADMIN_PASSWORD must be set in environment');
    console.log('   Usage: ADMIN_USERNAME=xxx ADMIN_PASSWORD=xxx node toggle-picker-permissions-test.js');
    process.exit(1);
}

async function loginAdmin() {
    const res = await axios.post(`${API}/auth/login`, {
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD
    });
    return res.data.token;
}

async function getAllPermissions(adminToken) {
    const res = await axios.get(`${API}/permissions/all`, { headers: { Authorization: `Bearer ${adminToken}` } });
    return res.data;
}

async function bulkUpdatePicker(adminToken, permissions) {
    await axios.post(`${API}/permissions/roles/picker/bulk-update`, { permissions }, { headers: { Authorization: `Bearer ${adminToken}` } });
}

async function getPickerPermissionsDirect(pickerToken) {
    const res = await axios.get(`${API}/permissions/my-permissions`, { headers: { Authorization: `Bearer ${pickerToken}` } });
    return res.data.permissions;
}

(async () => {
    try {
        console.log('🔐 Logging in as admin...');
        const adminToken = await loginAdmin();

        console.log('📋 Fetching all permissions...');
        const all = await getAllPermissions(adminToken);
        const keys = all.map(p => p.permission_key);
        console.log(`Found ${keys.length} permissions`);

        // Create disabled payload
        const disabledPayload = keys.map(k => ({ permission_key: k, enabled: false }));

        console.log('⛔ Disabling all permissions for picker role...');
        await bulkUpdatePicker(adminToken, disabledPayload);
        console.log('✅ Disabled all permissions for picker');

        // create picker token (simulate picker user id 11)
        const pickerToken = jwt.sign({ userId: 11, username: 'Panja', full_name: 'panja', role: 'picker' }, process.env.JWT_SECRET, { expiresIn: '1d' });

        const permsAfterDisable = await getPickerPermissionsDirect(pickerToken);
        const enabledAfterDisable = Object.values(permsAfterDisable).filter(v => v === true).length;
        console.log(`Enabled permissions for picker after disable: ${enabledAfterDisable}/${Object.keys(permsAfterDisable).length}`);

        console.log('✅ Now enabling all permissions for picker role...');
        const enabledPayload = keys.map(k => ({ permission_key: k, enabled: true }));
        await bulkUpdatePicker(adminToken, enabledPayload);
        console.log('✅ Enabled all permissions for picker');

        const permsAfterEnable = await getPickerPermissionsDirect(pickerToken);
        const enabledAfterEnable = Object.values(permsAfterEnable).filter(v => v === true).length;
        console.log(`Enabled permissions for picker after enable: ${enabledAfterEnable}/${Object.keys(permsAfterEnable).length}`);

        process.exit(0);
    } catch (e) {
        console.error('Error during test:', e.response?.data || e.message);
        process.exit(1);
    }
})();
