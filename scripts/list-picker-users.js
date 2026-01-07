require('dotenv').config();
const { Pool } = require('pg');

(async () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const result = await pool.query("SELECT id, username, full_name, role FROM users WHERE role='picker'");

        console.log('\n📋 Picker Users in Database:');
        console.log('━'.repeat(60));

        if (result.rows.length === 0) {
            console.log('❌ No picker users found');
        } else {
            result.rows.forEach(user => {
                console.log(`  ID: ${user.id}`);
                console.log(`  Username: ${user.username}`);
                console.log(`  Full Name: ${user.full_name || 'N/A'}`);
                console.log('  ' + '─'.repeat(56));
            });

            console.log(`\n✅ Total: ${result.rows.length} picker user(s)`);
            console.log('\n💡 To test, you need to know the password for one of these users.');
            console.log('   If you don\'t know it, reset it from the Users page in the admin account.');
        }

    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        await pool.end();
    }
})();
