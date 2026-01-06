-- ===============================================
-- WMS REPORTS PAGE TESTING SCRIPT
-- Test database mein sample data insert karne ke liye
-- ===============================================

-- 1. CHECK EXISTING DATA
SELECT 'Inbound Records' as table_name, COUNT(*) as count FROM inbound
UNION ALL
SELECT 'QC Records', COUNT(*) FROM qc
UNION ALL
SELECT 'Picking Records', COUNT(*) FROM picking
UNION ALL
SELECT 'Outbound Records', COUNT(*) FROM outbound
UNION ALL
SELECT 'Master Data', COUNT(*) FROM master_data;

-- 2. INSERT SAMPLE DATA FOR TESTING (if needed)
-- Ye sirf testing ke liye hai, agar aapke paas data nahi hai

-- Sample Inbound data (last 30 days)
INSERT INTO inbound (wsn, warehouse_id, inbound_date, vehicle_no, rack_no, quantity, created_user_id, created_user_name)
SELECT 
    'WSN' || LPAD(i::text, 6, '0'),
    1, -- warehouse_id (apna warehouse ID daal do)
    CURRENT_DATE - (random() * 30)::int * INTERVAL '1 day',
    'VH' || LPAD((random() * 1000)::int::text, 4, '0'),
    'R' || LPAD((random() * 100)::int::text, 3, '0'),
    (random() * 100 + 1)::int,
    1, -- user_id
    'Test User'
FROM generate_series(1, 50) as i
ON CONFLICT (wsn, warehouse_id) DO NOTHING;

-- Sample QC data
INSERT INTO qc (wsn, warehouse_id, qc_date, qc_status, qc_grade, qc_by, qc_by_name)
SELECT 
    wsn,
    warehouse_id,
    inbound_date + (random() * 5)::int * INTERVAL '1 day',
    CASE (random() * 4)::int 
        WHEN 0 THEN 'Pass'
        WHEN 1 THEN 'Done'
        WHEN 2 THEN 'Pending'
        ELSE 'Fail'
    END,
    CASE (random() * 4)::int 
        WHEN 0 THEN 'A'
        WHEN 1 THEN 'B'
        WHEN 2 THEN 'C'
        ELSE 'D'
    END,
    1,
    'QC User'
FROM inbound 
WHERE inbound_date >= CURRENT_DATE - INTERVAL '30 days'
LIMIT 40
ON CONFLICT (wsn, warehouse_id) DO NOTHING;

-- Sample Picking data
INSERT INTO picking (wsn, warehouse_id, picking_date, rack_no, picker_id, picker_name)
SELECT 
    i.wsn,
    i.warehouse_id,
    i.inbound_date + (random() * 10)::int * INTERVAL '1 day',
    i.rack_no,
    1,
    'Picker ' || ((random() * 5)::int + 1)::text
FROM inbound i
WHERE i.inbound_date >= CURRENT_DATE - INTERVAL '30 days'
AND EXISTS (SELECT 1 FROM qc WHERE qc.wsn = i.wsn AND qc.warehouse_id = i.warehouse_id)
LIMIT 30
ON CONFLICT (wsn, warehouse_id) DO NOTHING;

-- Sample Outbound data
INSERT INTO outbound (wsn, warehouse_id, dispatch_date, vehicle_no, customer_name)
SELECT 
    p.wsn,
    p.warehouse_id,
    p.picking_date + (random() * 5)::int * INTERVAL '1 day',
    'OUT' || LPAD((random() * 1000)::int::text, 4, '0'),
    'Customer ' || ((random() * 10)::int + 1)::text
FROM picking p
WHERE p.picking_date >= CURRENT_DATE - INTERVAL '30 days'
LIMIT 20
ON CONFLICT (wsn, warehouse_id) DO NOTHING;

-- 3. VERIFY SAMPLE DATA INSERTED
SELECT 
    'Recent Inbound' as category,
    COUNT(*) as count,
    MIN(inbound_date) as oldest,
    MAX(inbound_date) as newest
FROM inbound 
WHERE inbound_date >= CURRENT_DATE - INTERVAL '30 days'
UNION ALL
SELECT 
    'Recent QC',
    COUNT(*),
    MIN(qc_date),
    MAX(qc_date)
FROM qc 
WHERE qc_date >= CURRENT_DATE - INTERVAL '30 days'
UNION ALL
SELECT 
    'Recent Picking',
    COUNT(*),
    MIN(picking_date),
    MAX(picking_date)
FROM picking 
WHERE picking_date >= CURRENT_DATE - INTERVAL '30 days'
UNION ALL
SELECT 
    'Recent Outbound',
    COUNT(*),
    MIN(dispatch_date),
    MAX(dispatch_date)
FROM outbound 
WHERE dispatch_date >= CURRENT_DATE - INTERVAL '30 days';

-- 4. TEST TREND ANALYSIS QUERY
WITH date_series AS (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '29 days',
        CURRENT_DATE,
        '1 day'::interval
    )::date AS date
)
SELECT 
    ds.date,
    COALESCE(di.count, 0) as inbound,
    COALESCE(dq.count, 0) as qc,
    COALESCE(dp.count, 0) as picking,
    COALESCE(do.count, 0) as outbound
FROM date_series ds
LEFT JOIN (
    SELECT DATE(inbound_date) as date, COUNT(*) as count
    FROM inbound
    WHERE inbound_date IS NOT NULL 
    AND inbound_date >= CURRENT_DATE - INTERVAL '29 days'
    GROUP BY DATE(inbound_date)
) di ON ds.date = di.date
LEFT JOIN (
    SELECT DATE(qc_date) as date, COUNT(*) as count
    FROM qc
    WHERE qc_date IS NOT NULL 
    AND qc_date >= CURRENT_DATE - INTERVAL '29 days'
    GROUP BY DATE(qc_date)
) dq ON ds.date = dq.date
LEFT JOIN (
    SELECT DATE(picking_date) as date, COUNT(*) as count
    FROM picking
    WHERE picking_date IS NOT NULL 
    AND picking_date >= CURRENT_DATE - INTERVAL '29 days'
    GROUP BY DATE(picking_date)
) dp ON ds.date = dp.date
LEFT JOIN (
    SELECT DATE(dispatch_date) as date, COUNT(*) as count
    FROM outbound
    WHERE dispatch_date IS NOT NULL 
    AND dispatch_date >= CURRENT_DATE - INTERVAL '29 days'
    GROUP BY DATE(dispatch_date)
) do ON ds.date = do.date
ORDER BY ds.date ASC
LIMIT 10; -- First 10 days ka sample

-- 5. TEST QC ANALYSIS QUERY
SELECT 
    qc_status,
    qc_grade,
    COUNT(*) as count
FROM qc
GROUP BY qc_status, qc_grade
ORDER BY qc_status, qc_grade;

-- 6. TEST EXCEPTION REPORTS

-- Stuck in Inbound
SELECT 
    COUNT(*) as stuck_count,
    'Items stuck > 7 days' as description
FROM inbound i
WHERE i.inbound_date IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM qc WHERE qc.wsn = i.wsn)
AND i.inbound_date < CURRENT_DATE - INTERVAL '7 days';

-- QC Failed
SELECT 
    COUNT(*) as failed_count,
    'QC Failed items' as description
FROM qc
WHERE qc_status = 'Fail';

-- Slow Moving
SELECT 
    COUNT(*) as slow_moving_count,
    'Slow moving > 30 days' as description
FROM inbound i
WHERE i.inbound_date IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM picking WHERE picking.wsn = i.wsn)
AND i.inbound_date < CURRENT_DATE - INTERVAL '30 days';

-- ===============================================
-- VERIFICATION COMPLETE!
-- Ab browser mein Reports page check karo
-- ===============================================
