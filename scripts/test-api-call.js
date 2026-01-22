/**
 * Test API call to update manager permissions directly
 */

const http = require('http');

// First we need to get a token - let's simulate what the API would receive

async function testUpdatePermissions() {
    console.log('Testing direct API call to update manager role permissions...\n');

    // We need to make a PUT request to /api/permissions/roles/25/permissions
    // with a token that has super_admin role

    const permissions = [
        { code: 'menu:dashboard', is_enabled: true, is_visible: true },
        { code: 'btn:dashboard:columns', is_enabled: false, is_visible: true }
    ];

    const data = JSON.stringify({ permissions });

    const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/permissions/roles/25/permissions',
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
            // Note: This will fail without auth token, but it will show us the backend response
        }
    };

    const req = http.request(options, (res) => {
        console.log(`Status: ${res.statusCode}`);
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            console.log('Response:', body);
        });
    });

    req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
    });

    req.write(data);
    req.end();
}

testUpdatePermissions();
