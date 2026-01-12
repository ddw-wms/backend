require('dotenv').config();
const axios = require('axios');

async function run() {
    try {
        const base = 'http://localhost:5000/api';

        // Login as operator user
        const login = await axios.post(`${base}/auth/login`, {
            username: 'rbac_test_user',
            password: 'Passw0rd!'
        });

        const token = login.data.token;

        // Attempt to call multi-entry (should be forbidden unless user has create_picking)
        try {
            const res = await axios.post(`${base}/picking/multi-entry`, { items: [] }, { headers: { Authorization: `Bearer ${token}` } });
            console.log('Unexpected success:', res.status);
        } catch (err) {
            console.log('Expected denial status:', err.response?.status, '-', err.response?.data?.error || err.message);
        }
    } catch (err) {
        console.error('Error:', err.response?.data || err.message);
    }
}

run();