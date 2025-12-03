import { Request, Response } from 'express';
import { query } from '../config/database';

// Get complete inventory pipeline with all stages
export const getInventoryPipeline = async (req: Request, res: Response) => {
  try {
    const { warehouseId, page = 1, limit = 50, search, stage, brand, category, dateFrom, dateTo } = req.query;

    if (!warehouseId) {
      return res.status(400).json({ error: "Warehouse ID required" });
    }

    const offset = (Number(page) - 1) * Number(limit);
    const conditions: string[] = ["i.warehouse_id = $1"];
    const params: any[] = [warehouseId];
    let paramIndex = 2;

    /* 🔎 SEARCH */
    if (search) {
      conditions.push(`(i.wsn ILIKE $${paramIndex} OR i.product_title ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    /* 🏷 BRAND */
    if (brand) {
      conditions.push(`i.brand = $${paramIndex}`);
      params.push(brand);
      paramIndex++;
    }

    /* 📂 CATEGORY */
    if (category) {
      conditions.push(`i.cms_vertical = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    /* 🔥 STAGE FILTER — 100% CORRECT NOW */
    if (stage && stage !== "all") {
      conditions.push(`(
        CASE
          WHEN o.id IS NOT NULL AND o.dispatch_date IS NULL THEN 'OUTBOUND_READY'
          WHEN o.id IS NOT NULL THEN 'OUTBOUND_DISPATCHED'
          WHEN p.id IS NOT NULL AND p.picking_date IS NULL THEN 'PICKING_PENDING'
          WHEN p.id IS NOT NULL THEN 'PICKING_COMPLETED'
          WHEN q.id IS NOT NULL AND q.fk_grade = 'PASS' THEN 'QC_PASSED'
          WHEN q.id IS NOT NULL AND q.fk_grade = 'FAIL' THEN 'QC_FAILED'
          WHEN q.id IS NOT NULL THEN 'QC_PENDING'
          ELSE 'INBOUND_RECEIVED'
        END
      ) = $${paramIndex}`);
      params.push(stage);
      paramIndex++;
    }

    /* 📅 DATE FILTERS */
    if (dateFrom) {
      conditions.push(`i.inbound_date >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      conditions.push(`i.inbound_date <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    /* COUNT QUERY */
    const countSql = `
      SELECT COUNT(*)
      FROM inbound i
      LEFT JOIN qc q ON i.wsn = q.wsn AND i.warehouse_id = q.warehouse_id
      LEFT JOIN picking p ON i.wsn = p.wsn AND i.warehouse_id = p.warehouse_id
      LEFT JOIN outbound o ON i.wsn = o.wsn AND i.warehouse_id = o.warehouse_id
      WHERE ${whereClause}
    `;

    const countResult = await query(countSql, params);
    const total = Number(countResult.rows[0].count);

    /* MAIN DATA QUERY — FIXED & CLEAN */
    const sql = `
      SELECT
        i.id AS inbound_id,
        i.wsn,
        i.wid,
        i.fsn,
        i.order_id,
        i.product_title,
        i.brand,
        i.cms_vertical,
        i.mrp,
        i.fsp,
        i.inbound_date,
        'INBOUND_RECEIVED' AS inbound_status,
        i.rack_no,
        i.wh_location AS warehouse_location,
        i.hsn_sac,
        i.igst_rate,
        i.invoice_date,
        i.fkt_link,
        i.p_type,
        i.p_size,
        i.vrp,
        i.yield_value,
        i.fkqc_remark,
        i.fk_grade,
        q.id AS qc_id,
        q.qc_date,
        COALESCE(q.qc_remarks, 'Pending') AS qc_status,
        p.id AS picking_id,
        p.picking_date,
        COALESCE(p.picking_remarks, 'Pending') AS picking_status,
        o.id AS outbound_id,
        o.dispatch_date AS outbound_date,
        COALESCE(o.dispatch_remarks, 'Pending') AS outbound_status,
        o.vehicle_no,

        /* ⭐ FINAL FIXED STAGE LOGIC */
        CASE
          WHEN o.id IS NOT NULL AND o.dispatch_date IS NULL THEN 'OUTBOUND_READY'
          WHEN o.id IS NOT NULL THEN 'OUTBOUND_DISPATCHED'
          WHEN p.id IS NOT NULL AND p.picking_date IS NULL THEN 'PICKING_PENDING'
          WHEN p.id IS NOT NULL THEN 'PICKING_COMPLETED'
          WHEN q.id IS NOT NULL AND q.fk_grade = 'PASS' THEN 'QC_PASSED'
          WHEN q.id IS NOT NULL AND q.fk_grade = 'FAIL' THEN 'QC_FAILED'
          WHEN q.id IS NOT NULL THEN 'QC_PENDING'
          ELSE 'INBOUND_RECEIVED'
        END AS current_stage

      FROM inbound i
      LEFT JOIN qc q ON i.wsn = q.wsn AND i.warehouse_id = q.warehouse_id
      LEFT JOIN picking p ON i.wsn = p.wsn AND i.warehouse_id = p.warehouse_id
      LEFT JOIN outbound o ON i.wsn = o.wsn AND i.warehouse_id = o.warehouse_id
      WHERE ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(Number(limit), offset);

    const result = await query(sql, params);

    return res.json({
      data: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });

  } catch (error: any) {
    console.error("Get inventory pipeline error:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const getInventoryMetrics = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.query;

    if (!warehouseId) {
      return res.status(400).json({ error: 'Warehouse ID required' });
    }

    const sql = `
      WITH inbound_count AS (
        SELECT COUNT(*) as total FROM inbound WHERE warehouse_id = $1
      ),
      qc_count AS (
        SELECT
          COUNT(*) as qcPassed,
          SUM(CASE WHEN fk_grade = 'FAIL' THEN 1 ELSE 0 END) as qcFailed,
          SUM(CASE WHEN (fk_grade IS NULL OR fk_grade = '') THEN 1 ELSE 0 END) as qcPending
        FROM qc WHERE warehouse_id = $1
      ),
      picking_count AS (
        SELECT
          SUM(CASE WHEN picking_date IS NOT NULL THEN 1 ELSE 0 END) as pickingCompleted,
          SUM(CASE WHEN picking_date IS NULL THEN 1 ELSE 0 END) as pickingPending
        FROM picking WHERE warehouse_id = $1
      ),
      outbound_count AS (
        SELECT
          SUM(CASE WHEN dispatch_date IS NOT NULL THEN 1 ELSE 0 END) as outboundDispatched,
          SUM(CASE WHEN dispatch_date IS NULL THEN 1 ELSE 0 END) as outboundReady
        FROM outbound WHERE warehouse_id = $1
      )
      SELECT
        COALESCE(ic.total, 0) as total,
        COALESCE(ic.total, 0) as inbound,
        COALESCE(qc.qcPending, 0) as qcPending,
        COALESCE(qc.qcPassed, 0) as qcPassed,
        COALESCE(qc.qcFailed, 0) as qcFailed,
        COALESCE(p.pickingPending, 0) as pickingPending,
        COALESCE(p.pickingCompleted, 0) as pickingCompleted,
        COALESCE(o.outboundReady, 0) as outboundReady,
        COALESCE(o.outboundDispatched, 0) as outboundDispatched
      FROM inbound_count ic, qc_count qc, picking_count p, outbound_count o
    `;

    const result = await query(sql, [warehouseId]);
    const metrics = result.rows[0];

    res.json({
      total: parseInt(metrics.total) || 0,
      inbound: parseInt(metrics.inbound) || 0,
      qcPending: parseInt(metrics.qcpending) || 0,
      qcPassed: parseInt(metrics.qcpassed) || 0,
      qcFailed: parseInt(metrics.qcfailed) || 0,
      pickingPending: parseInt(metrics.pickingpending) || 0,
      pickingCompleted: parseInt(metrics.pickingcompleted) || 0,
      outboundReady: parseInt(metrics.outboundready) || 0,
      outboundDispatched: parseInt(metrics.outbounddispatched) || 0
    });
  } catch (error: any) {
    console.error('Get metrics error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get activity logs
export const getActivityLogs = async (req: Request, res: Response) => {
  try {
    const { warehouseId, page = 1, limit = 50 } = req.query;

    if (!warehouseId) {
      return res.status(400).json({ error: 'Warehouse ID required' });
    }

    const offset = (Number(page) - 1) * Number(limit);

    const sql = `
      SELECT
        ual.id,
        ual.user_id,
        u.full_name as user_name,
        ual.activity_type,
        ual.module,
        ual.details,
        ual.timestamp
      FROM user_activity_logs ual
      LEFT JOIN users u ON ual.user_id = u.id
      WHERE u.warehouse_id = $1
      ORDER BY ual.timestamp DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await query(sql, [warehouseId, Number(limit), offset]);

    res.json(result.rows);
  } catch (error: any) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ✅ EXPORT WITH COMPLETE DATA - FIXED: DATE CASTING + COLUMN NAME
export const getInventoryDataForExport = async (req: Request, res: Response) => {
  try {
    const {
      warehouseId,
      dateFrom,
      dateTo,
      stage,
      brand,
      category,
      searchText
    } = req.query;

    if (!warehouseId) {
      return res.status(400).json({ error: 'Warehouse ID required' });
    }

    // Build dynamic WHERE clause
    let whereConditions: string[] = ['i.warehouse_id = $1'];
    const params: any[] = [warehouseId];
    let paramIndex = 2;

    // Date filter
    if (dateFrom && dateTo) {
      whereConditions.push(`i.inbound_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(dateFrom, dateTo);
      paramIndex += 2;
    }

    // Brand filter
    if (brand && brand !== '') {
      whereConditions.push(`i.brand = $${paramIndex}`);
      params.push(brand);
      paramIndex++;
    }

    // Category filter
    if (category && category !== '') {
      whereConditions.push(`i.cms_vertical = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    // Search filter
    if (searchText && searchText !== '') {
      whereConditions.push(`(i.wsn ILIKE $${paramIndex} OR i.product_title ILIKE $${paramIndex})`);
      params.push(`%${searchText}%`);
      paramIndex++;
    }

    // Stage filter
    let stageFilter = '';
    if (stage && stage !== 'all') {
      if (stage === 'inbound') {
        stageFilter = 'AND (o.id IS NULL AND p.id IS NULL AND q.id IS NULL)';
      } else if (stage === 'qc') {
        stageFilter = 'AND (q.id IS NOT NULL AND p.id IS NULL)';
      } else if (stage === 'picking') {
        stageFilter = 'AND (p.id IS NOT NULL AND o.id IS NULL)';
      } else if (stage === 'outbound') {
        stageFilter = 'AND (o.id IS NOT NULL)';
      }
    }

    const whereClause = whereConditions.join(' AND ');

    const sql = `
      SELECT
        i.wsn,
        i.wid,
        i.fsn,
        i.order_id,
        i.product_title,
        i.brand,
        i.cms_vertical,
        i.fsp,
        i.mrp,
        i.inbound_date,
        i.vehicle_no,
        i.rack_no,
        i.wh_location,
        i.hsn_sac,
        i.igst_rate,
        i.invoice_date,
        i.fkt_link,
        i.p_type,
        i.p_size,
        i.vrp,
        i.yield_value,
        
        -- QC Details - ✅ CAST DATE TO TEXT TO HANDLE NULL VALUES
        COALESCE(q.qc_date::TEXT, '') as qc_date,
        COALESCE(q.qc_by, 'N/A') as qc_by,
        COALESCE(q.fk_grade, 'PENDING') as qc_grade,
        COALESCE(q.qc_remarks, '') as qc_remarks,
        COALESCE(q.fkqc_remark, '') as fkqc_remark,
        
        -- Picking Details - ✅ CAST DATE TO TEXT TO HANDLE NULL VALUES
        COALESCE(p.picking_date::TEXT, '') as picking_date,
        COALESCE(p.customer_name, '') as customer_name,
        COALESCE(p.picking_remarks, '') as picking_remarks,
        
        -- Outbound Details - ✅ CAST DATE TO TEXT TO HANDLE NULL VALUES + FIXED COLUMN NAME
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
        COALESCE(i.batch_id, 'SINGLE') as batch_id,
        i.created_at,
        COALESCE(i.created_user_name, 'System') as created_by
        
      FROM inbound i
      LEFT JOIN qc q ON i.wsn = q.wsn AND i.warehouse_id = q.warehouse_id
      LEFT JOIN picking p ON i.wsn = p.wsn AND i.warehouse_id = p.warehouse_id
      LEFT JOIN outbound o ON i.wsn = o.wsn AND i.warehouse_id = o.warehouse_id
      
      WHERE ${whereClause}
      ${stageFilter}
      
      ORDER BY i.created_at DESC
    `;

    const result = await query(sql, params);

    res.json({
      success: true,
      totalRecords: result.rows.length,
      data: result.rows,
      exportedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Export data error:', error);
    res.status(500).json({ error: error.message });
  }
};
