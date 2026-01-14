// File Path = warehouse-backend/src/controllers/dashboard.controller.ts
import { Request, Response } from 'express';
import { query } from '../config/database';

// Get complete inventory pipeline with all stages - OPTIMIZED for 1M+ rows
export const getInventoryPipeline = async (req: Request, res: Response) => {
  try {
    const { warehouseId, page = 1, limit = 50, search, stage, availableOnly, brand, category, dateFrom, dateTo } = req.query;

    if (!warehouseId) {
      return res.status(400).json({ error: "Warehouse ID required" });
    }

    const offset = (Number(page) - 1) * Number(limit);

    // Determine which JOINs are actually needed
    const needsMasterJoin = Boolean(search || brand || category);
    const needsStageJoins = Boolean(stage && stage !== 'all') || availableOnly === 'true';

    const conditions: string[] = ["i.warehouse_id = $1"];
    const countConditions: string[] = ["i.warehouse_id = $1"];
    const params: any[] = [warehouseId];
    const countParams: any[] = [warehouseId];
    let paramIndex = 2;
    let countParamIndex = 2;

    /* 🔎 SEARCH */
    if (search) {
      conditions.push(`(i.wsn ILIKE $${paramIndex} OR m.product_title ILIKE $${paramIndex})`);
      countConditions.push(`(i.wsn ILIKE $${countParamIndex} OR m.product_title ILIKE $${countParamIndex})`);
      params.push(`%${search}%`);
      countParams.push(`%${search}%`);
      paramIndex++;
      countParamIndex++;
    }

    /* 🏷 BRAND */
    if (brand) {
      conditions.push(`m.brand = $${paramIndex}`);
      countConditions.push(`m.brand = $${countParamIndex}`);
      params.push(brand);
      countParams.push(brand);
      paramIndex++;
      countParamIndex++;
    }

    /* 📂 CATEGORY */
    if (category) {
      conditions.push(`m.cms_vertical = $${paramIndex}`);
      countConditions.push(`m.cms_vertical = $${countParamIndex}`);
      params.push(category);
      countParams.push(category);
      paramIndex++;
      countParamIndex++;
    }

    /* 📅 DATE FILTERS */
    if (dateFrom && dateTo) {
      conditions.push(`i.inbound_date BETWEEN $${paramIndex}::date AND $${paramIndex + 1}::date`);
      countConditions.push(`i.inbound_date BETWEEN $${countParamIndex}::date AND $${countParamIndex + 1}::date`);
      params.push(dateFrom, dateTo);
      countParams.push(dateFrom, dateTo);
      paramIndex += 2;
      countParamIndex += 2;
    } else if (dateFrom) {
      conditions.push(`i.inbound_date >= $${paramIndex}::date`);
      countConditions.push(`i.inbound_date >= $${countParamIndex}::date`);
      params.push(dateFrom);
      countParams.push(dateFrom);
      paramIndex++;
      countParamIndex++;
    } else if (dateTo) {
      conditions.push(`i.inbound_date <= $${paramIndex}::date`);
      countConditions.push(`i.inbound_date <= $${countParamIndex}::date`);
      params.push(dateTo);
      countParams.push(dateTo);
      paramIndex++;
      countParamIndex++;
    }

    /* 📦 AVAILABLE ONLY */
    if (availableOnly === 'true') {
      conditions.push(`NOT EXISTS (SELECT 1 FROM outbound WHERE outbound.wsn = i.wsn AND outbound.warehouse_id = i.warehouse_id AND outbound.dispatch_date IS NOT NULL)`);
      countConditions.push(`NOT EXISTS (SELECT 1 FROM outbound WHERE outbound.wsn = i.wsn AND outbound.warehouse_id = i.warehouse_id AND outbound.dispatch_date IS NOT NULL)`);
    }

    /* 🔥 STAGE FILTER */
    let stageCondition = '';
    if (stage && stage !== "all") {
      if (stage === 'inbound') {
        // All items (no additional filter needed)
      } else if (stage === 'qc') {
        stageCondition = `AND EXISTS (SELECT 1 FROM qc WHERE qc.wsn = i.wsn AND qc.warehouse_id = i.warehouse_id AND qc.qc_grade IS NOT NULL)`;
      } else if (stage === 'picking') {
        stageCondition = `AND EXISTS (SELECT 1 FROM picking WHERE picking.wsn = i.wsn AND picking.warehouse_id = i.warehouse_id)`;
      } else if (stage === 'dispatched') {
        stageCondition = `AND EXISTS (SELECT 1 FROM outbound WHERE outbound.wsn = i.wsn AND outbound.warehouse_id = i.warehouse_id AND outbound.dispatch_date IS NOT NULL)`;
      }
    }

    const whereClause = conditions.join(" AND ");
    const countWhereClause = countConditions.join(" AND ");

    /* OPTIMIZED: Run count and ID queries in PARALLEL */
    const countSql = needsMasterJoin
      ? `SELECT COUNT(*) FROM inbound i LEFT JOIN master_data m ON m.wsn = i.wsn WHERE ${countWhereClause} ${stageCondition}`
      : `SELECT COUNT(*) FROM inbound i WHERE ${countWhereClause} ${stageCondition}`;

    const idsSql = `
      SELECT i.id
      FROM inbound i
      ${needsMasterJoin ? 'LEFT JOIN master_data m ON m.wsn = i.wsn' : ''}
      WHERE ${whereClause} ${stageCondition}
      ORDER BY i.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(Number(limit), offset);

    // Run both queries in parallel
    const [countResult, idsResult] = await Promise.all([
      query(countSql, countParams),
      query(idsSql, params)
    ]);

    const total = Number(countResult.rows[0].count);
    const ids = idsResult.rows.map((r: any) => r.id);

    if (ids.length === 0) {
      return res.json({
        data: [],
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    }

    /* PHASE 2: Fetch full data for IDs */
    const sql = `
      SELECT
        i.id AS inbound_id,
        i.wsn,
        m.wid, m.fsn, m.order_id, m.product_title, m.brand, m.cms_vertical,
        m.mrp, m.fsp, i.inbound_date, 'INBOUND_RECEIVED' AS inbound_status,
        i.rack_no, m.wh_location AS warehouse_location, m.hsn_sac, m.igst_rate,
        m.invoice_date, m.fkt_link, m.p_type, m.p_size, m.vrp, m.yield_value,
        m.fkqc_remark, m.fk_grade,
        q.id AS qc_id, q.qc_date,
        CASE WHEN q.id IS NOT NULL THEN 'DONE' ELSE 'Pending' END AS qc_status,
        p.id AS picking_id, p.picking_date,
        COALESCE(p.picking_remarks, 'Pending') AS picking_status,
        o.id AS outbound_id, o.dispatch_date AS outbound_date,
        COALESCE(o.dispatch_remarks, 'Pending') AS outbound_status, o.vehicle_no,
        CASE
          WHEN o.id IS NOT NULL AND o.dispatch_date IS NOT NULL THEN 'DISPATCHED'
          WHEN p.id IS NOT NULL THEN 'PICKING'
          WHEN q.id IS NOT NULL AND q.qc_grade IS NOT NULL THEN 'QC_DONE'
          ELSE 'INBOUND'
        END AS current_stage
      FROM inbound i
      LEFT JOIN master_data m ON m.wsn = i.wsn
      LEFT JOIN qc q ON i.wsn = q.wsn AND i.warehouse_id = q.warehouse_id
      LEFT JOIN picking p ON i.wsn = p.wsn AND i.warehouse_id = p.warehouse_id
      LEFT JOIN outbound o ON i.wsn = o.wsn AND i.warehouse_id = o.warehouse_id
      WHERE i.id = ANY($1)
      ORDER BY i.created_at DESC
    `;
    const result = await query(sql, [ids]);

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
      WITH master_count AS (
        -- Master Data total (global, warehouse_id column nahi hai)
        SELECT COUNT(*) as total FROM master_data
      ),
      inbound_count AS (
        -- Inbound per warehouse (jaisa pehle tha)
        SELECT COUNT(*) as total FROM inbound WHERE warehouse_id = $1
      ),
      qc_count AS (
        SELECT
          SUM(CASE WHEN qc_status = 'Pass' THEN 1 ELSE 0 END) as qcPassed,
          SUM(CASE WHEN qc_status = 'Fail' THEN 1 ELSE 0 END) as qcFailed,
          SUM(CASE WHEN qc_status = 'Done' THEN 1 ELSE 0 END) as qcDone,
          SUM(CASE WHEN (qc_status IS NULL OR qc_status = '' OR qc_status = 'Pending') THEN 1 ELSE 0 END) as qcPending
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
        COALESCE(mc.total, 0)  as mastertotal,
        COALESCE(ic.total, 0)  as inboundtotal,
        COALESCE(qc.qcPending, 0)        as qcPending,
        COALESCE(qc.qcPassed, 0)         as qcPassed,
        COALESCE(qc.qcFailed, 0)         as qcFailed,
        COALESCE(qc.qcDone, 0)           as qcDone,
        COALESCE(p.pickingPending, 0)    as pickingPending,
        COALESCE(p.pickingCompleted, 0)  as pickingCompleted,
        COALESCE(o.outboundReady, 0)     as outboundReady,
        COALESCE(o.outboundDispatched, 0) as outboundDispatched
      FROM master_count mc, inbound_count ic, qc_count qc, picking_count p, outbound_count o
    `;

    const result = await query(sql, [warehouseId]);
    const metrics = result.rows[0];

    const qcPassed = parseInt(metrics.qcpassed) || 0;
    const qcDone = parseInt(metrics.qcdone) || 0;

    res.json({
      // Master Data total (export / uploads se aayega, inbound ke bina bhi)
      total: parseInt(metrics.mastertotal) || 0,
      // Inbound total alag se
      inbound: parseInt(metrics.inboundtotal) || 0,
      qcPending: parseInt(metrics.qcpending) || 0,
      qcPassed: qcPassed,
      qcDone: qcDone,
      // qcTotal counts both explicit Pass and Done entries
      qcTotal: qcPassed + qcDone,
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
      search: searchText,   // 🔁 rename: frontend 'search' -> searchText
    } = req.query as any;

    if (!warehouseId) {
      return res.status(400).json({ error: 'Warehouse ID required' });
    }

    // Build dynamic WHERE clause
    let whereConditions: string[] = ['i.warehouse_id = $1'];
    const params: any[] = [warehouseId];
    let paramIndex = 2;

    // Date filter
    if (dateFrom && dateTo) {
      whereConditions.push(`i.inbound_date::text BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      params.push(dateFrom, dateTo);
      paramIndex += 2;
    } else if (dateFrom) {
      whereConditions.push(`i.inbound_date::text >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex += 1;
    } else if (dateTo) {
      whereConditions.push(`i.inbound_date::text <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex += 1;
    }



    // Brand filter
    if (brand && brand !== '') {
      whereConditions.push(`m.brand = $${paramIndex}`);
      params.push(brand);
      paramIndex++;
    }

    // Category filter
    if (category && category !== '') {
      whereConditions.push(`m.cms_vertical = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    // Search filter
    if (searchText && searchText !== '') {
      whereConditions.push(`(i.wsn ILIKE $${paramIndex} OR i.product_title ILIKE $${paramIndex})`);
      params.push(`%${searchText}%`);
      paramIndex++;
    }


    // Available Only (export scope) - exclude only dispatched items
    if ((req.query as any).availableOnly === 'true') {
      whereConditions.push(`NOT EXISTS (SELECT 1 FROM outbound WHERE outbound.wsn = i.wsn AND outbound.warehouse_id = i.warehouse_id AND outbound.dispatch_date IS NOT NULL)`);
    }

    // Stage filter – simplified to match app workflow (inbound/qc/picking/dispatched)
    let stageFilter = '';
    if (stage && stage !== 'all') {
      if (stage === 'inbound') {
        // Ensure export includes all inbounded items regardless of downstream state
        stageFilter = `AND (
          CASE
            WHEN o.id IS NOT NULL AND o.dispatch_date IS NOT NULL THEN 'DISPATCHED'
            WHEN p.id IS NOT NULL THEN 'PICKING'
            WHEN q.id IS NOT NULL AND q.qc_grade IS NOT NULL THEN 'QC_DONE'
            ELSE 'INBOUND'
          END
        ) IN ('INBOUND','QC_DONE','PICKING','DISPATCHED')`;
      } else if (stage === 'qc') {
        stageFilter = 'AND (q.qc_grade IS NOT NULL)';
      } else if (stage === 'picking') {
        stageFilter = 'AND (p.id IS NOT NULL)';
      } else if (stage === 'dispatched') {
        stageFilter = 'AND (o.dispatch_date IS NOT NULL)';
      }
    }
    const whereClause = whereConditions.join(' AND ');

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
        -- NOTE: fkqc_remark is in master_data
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

    const result = await query(sql, params);

    return res.json({
      success: true,
      totalRecords: result.rows.length,
      data: result.rows,
      exportedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Export data error:', error);
    res.status(500).json({ error: error.message });
  }
};