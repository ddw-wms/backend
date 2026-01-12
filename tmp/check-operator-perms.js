require('dotenv').config();
const axios = require('axios');

(async () => {
    try {
        const login = await axios.post('http://localhost:5000/api/auth/login', { username: 'admin', password: 'admin123' });
        const token = login.data.token;

        const res = await axios.get('http://localhost:5000/api/permissions/roles/operator', { headers: { Authorization: `Bearer ${token}` } });
        console.log('Received', res.data.length, 'permissions for operator sample:');
        console.log(res.data.slice(0, 20).map(p => `${p.permission_key}=${p.enabled}`));

        // Check specific perm
        const createPicking = res.data.find(p => p.permission_key === 'create_picking');
        console.log('create_picking present?', !!createPicking, 'enabled?', createPicking?.enabled);
    } catch (err) {
        console.error('Error:', err.response?.data || err.message);
    }
})();