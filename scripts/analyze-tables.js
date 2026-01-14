require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function analyzeTables() {
    console.log('🔄 Running ANALYZE on all tables to update statistics...\n');

    const tables = ['inbound', 'master_data', 'qc', 'picking', 'outbound'];

    for (const table of tables) {
        console.log(`  Analyzing ${table}...`);
        const start = Date.now();
        await pool.query(`ANALYZE ${table}`);
        console.log(`  ✓ ${table} analyzed (${Date.now() - start}ms)`);
    }

    console.log('\n🔍 Testing query performance...\n');

    // Test inbound list query (the main slow one)
    console.log('📊 INBOUND LIST QUERY TEST:');

    // Get warehouse_id
    const whResult = await pool.query('SELECT id FROM warehouses LIMIT 1');
    const warehouseId = whResult.rows[0]?.id;

    if (!warehouseId) {
        console.log('No warehouse found');
        await pool.end();
        return;
    }

    // Test 1: Simple count without JOIN
    console.log('\n  Test 1: COUNT without JOIN');
    let start = Date.now();
    const countResult = await pool.query(
        'SELECT COUNT(*) FROM inbound WHERE warehouse_id = $1',
        [warehouseId]
    );
    console.log(`  ✓ Count: ${countResult.rows[0].count} rows in ${Date.now() - start}ms`);

    // Test 2: Count with master_data JOIN  
    console.log('\n  Test 2: COUNT with master_data JOIN');
    start = Date.now();
    const countJoinResult = await pool.query(`
    SELECT COUNT(*) FROM inbound i
    LEFT JOIN master_data m ON UPPER(i.wsn) = UPPER(m.wsn)
    WHERE i.warehouse_id = $1
  `, [warehouseId]);
    console.log(`  ✓ Count with JOIN: ${countJoinResult.rows[0].count} rows in ${Date.now() - start}ms`);

    // Test 3: Get IDs only with pagination (Phase 1)
    console.log('\n  Test 3: Get 100 IDs with ORDER BY (Phase 1)');
    start = Date.now();
    const idsResult = await pool.query(`
    SELECT id FROM inbound 
    WHERE warehouse_id = $1
    ORDER BY created_at DESC
    LIMIT 100
  `, [warehouseId]);
    console.log(`  ✓ Got ${idsResult.rows.length} IDs in ${Date.now() - start}ms`);

    // Test 4: Get full data for those IDs (Phase 2)
    if (idsResult.rows.length > 0) {
        console.log('\n  Test 4: Get full data for 100 IDs with JOIN (Phase 2)');
        const ids = idsResult.rows.map(r => r.id);
        start = Date.now();
        const dataResult = await pool.query(`
      SELECT i.*, 
        m.product_title, m.brand, m.cms_vertical, m.fsp, m.mrp,
        m.wid, m.fsn, m.order_id, m.hsn_sac, m.igst_rate
      FROM inbound i
      LEFT JOIN master_data m ON UPPER(i.wsn) = UPPER(m.wsn)
      WHERE i.id = ANY($1)
      ORDER BY i.created_at DESC
    `, [ids]);
        console.log(`  ✓ Got ${dataResult.rows.length} full rows in ${Date.now() - start}ms`);
    }

    // Test 5: Old query style (full scan with JOIN)
    console.log('\n  Test 5: OLD STYLE - Full query with JOIN and LIMIT');
    start = Date.now();
    const oldStyleResult = await pool.query(`
    SELECT i.*, 
      m.product_title, m.brand, m.cms_vertical, m.fsp, m.mrp
    FROM inbound i
    LEFT JOIN master_data m ON UPPER(i.wsn) = UPPER(m.wsn)
    WHERE i.warehouse_id = $1
    ORDER BY i.created_at DESC
    LIMIT 100
  `, [warehouseId]);
    console.log(`  ✓ OLD style got ${oldStyleResult.rows.length} rows in ${Date.now() - start}ms`);

    // Check EXPLAIN for the slow query
    console.log('\n📋 EXPLAIN ANALYZE for slow query:');
    const explainResult = await pool.query(`
    EXPLAIN ANALYZE 
    SELECT i.id FROM inbound i
    WHERE i.warehouse_id = $1
    ORDER BY i.created_at DESC
    LIMIT 100
  `, [warehouseId]);
    console.log(explainResult.rows.map(r => r['QUERY PLAN']).join('\n'));

    await pool.end();
    console.log('\n✅ Analysis complete!');
}

analyzeTables().catch(e => {
    console.error('Error:', e);
    process.exit(1);
});
