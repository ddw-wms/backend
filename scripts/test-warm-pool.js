require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,  // More connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

async function testWithWarmPool() {
    console.log('🔥 PERFORMANCE TEST WITH WARM CONNECTION POOL\n');

    // Warm up connection
    await pool.query('SELECT 1');
    console.log('Connection warmed up!\n');

    const warehouseId = 1;

    // Run each query 3 times to see if caching helps
    for (let run = 1; run <= 3; run++) {
        console.log(`=== Run ${run} ===`);

        let start = Date.now();
        const count = await pool.query('SELECT COUNT(*) FROM inbound WHERE warehouse_id = $1', [warehouseId]);
        console.log(`COUNT (no join): ${Date.now() - start}ms - ${count.rows[0].count} rows`);

        start = Date.now();
        const countJoin = await pool.query(
            'SELECT COUNT(*) FROM inbound i LEFT JOIN master_data m ON i.wsn = m.wsn WHERE i.warehouse_id = $1',
            [warehouseId]
        );
        console.log(`COUNT (direct join): ${Date.now() - start}ms`);

        start = Date.now();
        const ids = await pool.query(
            'SELECT id FROM inbound WHERE warehouse_id = $1 ORDER BY created_at DESC LIMIT 100',
            [warehouseId]
        );
        console.log(`Get 100 IDs: ${Date.now() - start}ms`);

        start = Date.now();
        const idList = ids.rows.map(r => r.id);
        const data = await pool.query(
            `SELECT i.*, m.product_title, m.brand, m.cms_vertical, m.fsp, m.mrp
       FROM inbound i 
       LEFT JOIN master_data m ON i.wsn = m.wsn 
       WHERE i.id = ANY($1) 
       ORDER BY i.created_at DESC`,
            [idList]
        );
        console.log(`Full data for 100: ${Date.now() - start}ms - ${data.rows.length} rows`);

        console.log('');
    }

    // Summary timing - simulate what API does
    console.log('=== SIMULATED API CALL ===');
    const apiStart = Date.now();

    // Step 1: Count
    const t1 = Date.now();
    await pool.query('SELECT COUNT(*) FROM inbound WHERE warehouse_id = $1', [warehouseId]);
    const countTime = Date.now() - t1;

    // Step 2: Get IDs
    const t2 = Date.now();
    const apiIds = await pool.query(
        'SELECT id FROM inbound WHERE warehouse_id = $1 ORDER BY created_at DESC LIMIT 100',
        [warehouseId]
    );
    const idsTime = Date.now() - t2;

    // Step 3: Get Data
    const t3 = Date.now();
    await pool.query(
        `SELECT i.*, m.product_title, m.brand, m.cms_vertical, m.fsp, m.mrp
     FROM inbound i 
     LEFT JOIN master_data m ON i.wsn = m.wsn 
     WHERE i.id = ANY($1) 
     ORDER BY i.created_at DESC`,
        [apiIds.rows.map(r => r.id)]
    );
    const dataTime = Date.now() - t3;

    console.log(`Total API Time: ${Date.now() - apiStart}ms`);
    console.log(`  - Count: ${countTime}ms`);
    console.log(`  - IDs: ${idsTime}ms`);
    console.log(`  - Data: ${dataTime}ms`);

    await pool.end();
}

testWithWarmPool().catch(console.error);
