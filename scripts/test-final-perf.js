require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
});

async function testParallelQueries() {
    console.log('🚀 FINAL PERFORMANCE TEST - PARALLEL QUERIES\n');

    // Warm up
    await pool.query('SELECT 1');

    const warehouseId = 1;

    // Test 1: Sequential (OLD)
    console.log('=== SEQUENTIAL (old way) ===');
    let start = Date.now();

    // Count
    const count1 = await pool.query('SELECT COUNT(*) FROM inbound WHERE warehouse_id = $1', [warehouseId]);
    // IDs
    const ids1 = await pool.query(
        'SELECT id FROM inbound WHERE warehouse_id = $1 ORDER BY created_at DESC LIMIT 100',
        [warehouseId]
    );
    // Data
    await pool.query(
        `SELECT i.*, m.product_title, m.brand, m.cms_vertical, m.fsp, m.mrp
     FROM inbound i LEFT JOIN master_data m ON i.wsn = m.wsn 
     WHERE i.id = ANY($1) ORDER BY i.created_at DESC`,
        [ids1.rows.map(r => r.id)]
    );
    console.log(`Sequential Total: ${Date.now() - start}ms`);

    // Test 2: Parallel (NEW)
    console.log('\n=== PARALLEL (new way) ===');
    start = Date.now();

    // Count + IDs in parallel
    const [count2, ids2] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM inbound WHERE warehouse_id = $1', [warehouseId]),
        pool.query(
            'SELECT id FROM inbound WHERE warehouse_id = $1 ORDER BY created_at DESC LIMIT 100',
            [warehouseId]
        )
    ]);
    // Data
    await pool.query(
        `SELECT i.*, m.product_title, m.brand, m.cms_vertical, m.fsp, m.mrp
     FROM inbound i LEFT JOIN master_data m ON i.wsn = m.wsn 
     WHERE i.id = ANY($1) ORDER BY i.created_at DESC`,
        [ids2.rows.map(r => r.id)]
    );
    console.log(`Parallel Total: ${Date.now() - start}ms`);

    // Run multiple times
    console.log('\n=== 5 CONSECUTIVE PARALLEL REQUESTS ===');
    for (let i = 1; i <= 5; i++) {
        start = Date.now();
        const [c, d] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM inbound WHERE warehouse_id = $1', [warehouseId]),
            pool.query(
                'SELECT id FROM inbound WHERE warehouse_id = $1 ORDER BY created_at DESC LIMIT 100',
                [warehouseId]
            )
        ]);
        await pool.query(
            `SELECT i.*, m.product_title, m.brand, m.cms_vertical, m.fsp, m.mrp
       FROM inbound i LEFT JOIN master_data m ON i.wsn = m.wsn 
       WHERE i.id = ANY($1) ORDER BY i.created_at DESC`,
            [d.rows.map(r => r.id)]
        );
        console.log(`Request ${i}: ${Date.now() - start}ms`);
    }

    await pool.end();
    console.log('\n✅ Test complete!');
}

testParallelQueries().catch(console.error);
