require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function testRealPerformance() {
    const warehouseId = 1; // Bangalore - has 177K rows

    console.log('🔍 REAL PERFORMANCE TEST (Warehouse ID: 1 with 177K rows)\n');
    console.log('='.repeat(60));

    // Test 1: Simple count
    console.log('\n📊 Test 1: Simple COUNT (no JOIN)');
    let start = Date.now();
    const count1 = await pool.query(
        'SELECT COUNT(*) FROM inbound WHERE warehouse_id = $1',
        [warehouseId]
    );
    const time1 = Date.now() - start;
    console.log(`   Result: ${count1.rows[0].count} rows`);
    console.log(`   ⏱️  Time: ${time1}ms ${time1 < 100 ? '✅ FAST' : time1 < 500 ? '⚠️ OK' : '❌ SLOW'}`);

    // Test 2: Count with JOIN
    console.log('\n📊 Test 2: COUNT with master_data JOIN');
    start = Date.now();
    const count2 = await pool.query(`
    SELECT COUNT(*) FROM inbound i
    LEFT JOIN master_data m ON UPPER(i.wsn) = UPPER(m.wsn)
    WHERE i.warehouse_id = $1
  `, [warehouseId]);
    const time2 = Date.now() - start;
    console.log(`   Result: ${count2.rows[0].count} rows`);
    console.log(`   ⏱️  Time: ${time2}ms ${time2 < 500 ? '✅ FAST' : time2 < 2000 ? '⚠️ OK' : '❌ SLOW'}`);

    // Test 3: Get IDs only (Phase 1 of two-phase)
    console.log('\n📊 Test 3: Get 100 IDs with ORDER BY (optimized Phase 1)');
    start = Date.now();
    const ids = await pool.query(`
    SELECT id FROM inbound 
    WHERE warehouse_id = $1
    ORDER BY created_at DESC
    LIMIT 100
  `, [warehouseId]);
    const time3 = Date.now() - start;
    console.log(`   Result: ${ids.rows.length} IDs`);
    console.log(`   ⏱️  Time: ${time3}ms ${time3 < 50 ? '✅ FAST' : time3 < 200 ? '⚠️ OK' : '❌ SLOW'}`);

    // Test 4: Get full data for IDs (Phase 2)
    console.log('\n📊 Test 4: Get full data for 100 IDs with JOIN (Phase 2)');
    const idList = ids.rows.map(r => r.id);
    start = Date.now();
    const data = await pool.query(`
    SELECT i.*, 
      m.product_title, m.brand, m.cms_vertical, m.fsp, m.mrp,
      m.wid, m.fsn, m.order_id, m.hsn_sac, m.igst_rate
    FROM inbound i
    LEFT JOIN master_data m ON UPPER(i.wsn) = UPPER(m.wsn)
    WHERE i.id = ANY($1)
    ORDER BY i.created_at DESC
  `, [idList]);
    const time4 = Date.now() - start;
    console.log(`   Result: ${data.rows.length} rows with all fields`);
    console.log(`   ⏱️  Time: ${time4}ms ${time4 < 200 ? '✅ FAST' : time4 < 500 ? '⚠️ OK' : '❌ SLOW'}`);

    // Test 5: OLD style (what was happening before)
    console.log('\n📊 Test 5: OLD STYLE - Direct query with JOIN');
    start = Date.now();
    const oldStyle = await pool.query(`
    SELECT i.*, 
      m.product_title, m.brand, m.cms_vertical, m.fsp, m.mrp
    FROM inbound i
    LEFT JOIN master_data m ON UPPER(i.wsn) = UPPER(m.wsn)
    WHERE i.warehouse_id = $1
    ORDER BY i.created_at DESC
    LIMIT 100
  `, [warehouseId]);
    const time5 = Date.now() - start;
    console.log(`   Result: ${oldStyle.rows.length} rows`);
    console.log(`   ⏱️  Time: ${time5}ms ${time5 < 500 ? '✅ FAST' : time5 < 2000 ? '⚠️ OK' : '❌ SLOW'}`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 SUMMARY:');
    console.log(`   Two-Phase Total: ${time1 + time3 + time4}ms (Count: ${time1}ms + IDs: ${time3}ms + Data: ${time4}ms)`);
    console.log(`   Old Style Total: ${time2 + time5}ms (Count with JOIN: ${time2}ms + Data: ${time5}ms)`);
    console.log(`   Improvement: ${Math.round(((time2 + time5) - (time1 + time3 + time4)) / (time2 + time5) * 100)}% faster`);

    // Check if indexes are being used
    console.log('\n📋 EXPLAIN for ID query:');
    const explain = await pool.query(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT id FROM inbound 
    WHERE warehouse_id = $1
    ORDER BY created_at DESC
    LIMIT 100
  `, [warehouseId]);
    explain.rows.forEach(r => console.log('   ' + r['QUERY PLAN']));

    await pool.end();
}

testRealPerformance().catch(e => {
    console.error('Error:', e);
    process.exit(1);
});
