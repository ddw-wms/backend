require('dotenv').config();
import db from '../src/config/database';
(async () => {
    try {
        const pool = await db.initializeDatabase();

        const whereClause = "i.warehouse_id = $1";
        const stageFilter = '';
        const sql = `
      SELECT
        i.wsn,
        m.wid,
        m.fsn,
        m.order_id,
        m.product_title,
        m.brand,
        m.cms_vertical,
        m.fsp,
        m.mrp,
        i.inbound_date,
        i.vehicle_no,
        i.rack_no,
        m.wh_location,
        m.hsn_sac,
        m.igst_rate,
        m.invoice_date,
        m.fkt_link,
        m.p_type,
        m.p_size,
        m.vrp,
        m.yield_value,
        -- QC Details
        COALESCE(q.qc_date::TEXT, '') as qc_date,
        COALESCE(q.qc_by::TEXT, 'N/A') as qc_by,
        COALESCE(q.qc_grade, 'PENDING') as qc_grade,
        COALESCE(q.qc_remarks, '') as qc_remarks,
        COALESCE(m.fkqc_remark, '') as fkqc_remark,
        -- Picking Details
        COALESCE(p.picking_date::TEXT, '') as picking_date,
        COALESCE(p.customer_name, '') as customer_name,
        COALESCE(p.picking_remarks, '') as picking_remarks,
        -- Outbound Details
        COALESCE(o.dispatch_date::TEXT, '') as dispatch_date,
        COALESCE(o.vehicle_no, '') as dispatch_vehicle,
        COALESCE(o.dispatch_remarks, '') as dispatch_remarks,
        -- Status
        CASE
          WHEN o.id IS NOT NULL THEN 'DISPATCHED'
          WHEN p.id IS NOT NULL THEN 'PICKED'
          WHEN q.id IS NOT NULL THEN 'QC_DONE'
          ELSE 'INBOUND'
        END as current_status,
        -- Batch Info
        COALESCE(i.batch_id::TEXT, 'SINGLE') as batch_id,
        i.created_at,
        COALESCE(i.created_user_name, 'System') as created_by
      FROM inbound i
      LEFT JOIN master_data m ON m.wsn = i.wsn
      LEFT JOIN qc q ON i.wsn = q.wsn AND i.warehouse_id = q.warehouse_id
      LEFT JOIN picking p ON i.wsn = p.wsn AND i.warehouse_id = p.warehouse_id
      LEFT JOIN outbound o ON i.wsn = o.wsn AND i.warehouse_id = o.warehouse_id

      WHERE ${whereClause}
      ${stageFilter}
      ORDER BY i.created_at DESC
    `;

        const params = [1];

        console.log('running export SQL');
        const res = await pool.query(sql, params);
        console.log('rows:', res.rows.length);
        process.exit(0);
    } catch (err) {
        console.error('test export error', err);
        process.exit(1);
    }
})();