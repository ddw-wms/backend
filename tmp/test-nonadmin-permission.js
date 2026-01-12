require('dotenv').config();
const axios = require('axios');

async function run() {
    try {
        const base = 'http://localhost:5000/api';

        // Try to register a new test user
        await axios.post(`${base}/auth/register`, {
            username: 'rbac_test_user',
            password: 'Passw0rd!'
        }).catch(e => {
            if (e.response && e.response.status === 409) {
                console.log('User already exists, continuing');
            } else {
                throw e;
            }
        });

        // Login
        const login = await axios.post(`${base}/auth/login`, {
            username: 'rbac_test_user',
            password: 'Passw0rd!'
        });

        const token = login.data.token;
        console.log('Logged in as', login.data.user.username, 'role', login.data.user.role);

        // Call admin-only endpoint
        try {
            const res = await axios.get(`${base}/permissions/all`, { headers: { Authorization: `Bearer ${token}` } });
            console.log('Unexpected success: user could access admin endpoint.');
            console.log('Permissions count:', res.data.length);
        } catch (err) {
            console.log('Expected failure when non-admin accesses admin endpoint:', err.response?.status, err.response?.data?.error);
        }

    } catch (err) {
        console.error('Error in test:', err.response?.data || err.message);
    }
}

run();