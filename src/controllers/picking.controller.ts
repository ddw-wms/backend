// File Path = warehouse-backend/src/controllers/picking.controller.ts
import { Request, Response } from 'express';
import { query } from '../config/database';

// ====== GET SOURCE DATA BY WSN (QC → INBOUND → MASTER) ======
export const getSourceByWSN = async (req: Request, res: Response) => {
  try {
    const { wsn, warehouseId } = req.query;

    if (!wsn || !warehouseId) {
      return res.status(400).json({ error: 'WSN and warehouse ID required' });
    }

    // Priority 1: Check QC with master_data join
    let sql = `
      SELECT 
        q.*, 
        m.product_title, m.brand, m.cms_vertical, m.mrp, m.fsp,
        m.hsn_sac, m.igst_rate, m.p_type, m.p_size, m.vrp,
        m.wid, m.fsn, m.order_id, m.fkqc_remark, m.fk_grade,
        m.invoice_date, m.fkt_link, m.wh_location, m.yield_value,
        'QC' as source 
      FROM qc q 
      LEFT JOIN master_data m ON q.wsn = m.wsn
      WHERE q.wsn = $1 AND q.warehouse_id = $2 
      LIMIT 1
    `;
    let result = await query(sql, [wsn, warehouseId]);

    if (result.rows.length === 0) {
      // Priority 2: Check Inbound with master_data join
      sql = `
        SELECT 
          i.*, 
          m.product_title, m.brand, m.cms_vertical, m.mrp, m.fsp,
          m.hsn_sac, m.igst_rate, m.p_type, m.p_size, m.vrp,
          m.wid, m.fsn, m.order_id, m.fkqc_remark, m.fk_grade,
          m.invoice_date, m.fkt_link, m.wh_location, m.yield_value,
          'INBOUND' as source 
        FROM inbound i 
        LEFT JOIN master_data m ON i.wsn = m.wsn
        WHERE i.wsn = $1 AND i.warehouse_id = $2 
        LIMIT 1
      `;
      result = await query(sql, [wsn, warehouseId]);

      if (result.rows.length === 0) {
        // Priority 3: Check Master Data only
        sql = `SELECT m.*, 'MASTER' as source FROM master_data m WHERE m.wsn = $1 LIMIT 1`;
        result = await query(sql, [wsn]);

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'WSN not found in any table' });
        }
      }
    }

    const row = result.rows[0];

    res.json({
      wsn: row.wsn,

      // ---- MASTER DISPLAY FIELDS (GRID KE LIYE) ----
      product_title:
        row.product_title ||
        row.product_name ||
        row.title ||
        null,

      brand:
        row.brand ||
        row.brand_name ||
        null,

      mrp:
        row.mrp ||
        row.mrp_price ||
        null,

      fsp:
        row.fsp ||
        row.fsp_price ||
        null,

      cms_vertical:
        row.cms_vertical ||
        row.category ||
        null,

      p_type:
        row.p_type ||
        row.product_type ||
        null,

      p_size:
        row.p_size ||
        row.size ||
        null,

      vrp:
        row.vrp ||
        null,

      hsn_sac:
        row.hsn_sac ||
        null,

      igst_rate:
        row.igst_rate ||
        null,

      // ---- RACK INFO ----
      rack_no:
        row.rack_no ||
        null,

      // ---- QC SPECIFIC FIELDS ----
      fkqc_remark:
        row.fkqc_remark ||
        null,

      fk_grade:
        row.fk_grade ||
        null,

      // ---- INBOUND SPECIFIC FIELDS ----
      invoice_date:
        row.invoice_date ||
        null,

      fkt_link:
        row.fkt_link ||
        null,

      wh_location:
        row.wh_location ||
        null,

      yield_value:
        row.yield_value ||
        null,

      // ---- EXTRA IDENTIFIERS ----
      wid: row.wid || null,
      fsn: row.fsn || null,
      order_id: row.order_id || null,

      // ---- META ----
      source: row.source
    });

  } catch (error: any) {
    console.error('Get source by WSN error:', error);
    res.status(500).json({ error: error.message });
  }

};

// ====== MULTI PICKING ENTRY WITH AUTO BATCH ID ======
export const multiPickingEntry = async (req: Request, res: Response) => {
  try {
    const { entries, warehouse_id } = req.body;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Entries array required' });
    }

    if (!warehouse_id) {
      return res.status(400).json({ error: 'Warehouse ID required' });
    }

    // Generate batch ID: PICK_MULTI_YYYYMMDD_HHMMSS
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const batchId = `PICK_MULTI_${dateStr}_${timeStr}`;

    let successCount = 0;
    const errors: any[] = [];

    for (const entry of entries) {
      try {

        const sql = `
          INSERT INTO picking (
            picking_date, picker_name, customer_name, wsn, 
            picking_remarks, quantity, source, batch_id,
            warehouse_id, warehouse_name, other_remarks, rack_no, created_user_name
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
          )
        `;

        await query(sql, [
          entry.picking_date || null,
          entry.picker_name || null,
          entry.customer_name || null,
          entry.wsn,
          entry.picking_remarks || null,
          entry.quantity || 1,
          entry.source || 'MANUAL',
          batchId,
          warehouse_id,
          entry.warehouse_name || null,
          entry.other_remarks || null,
          entry.rack_no || null,
          entry.created_user_name || null
        ]);

        successCount++;
      } catch (err: any) {
        console.error('❌ Error inserting WSN:', entry.wsn, err.message);
        errors.push({ wsn: entry.wsn, error: err.message });
      }
    }

    res.json({
      success: true,
      batchId,
      successCount,
      totalCount: entries.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('Multi picking entry error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====== GET PICKING LIST WITH FILTERS & PAGINATION ======
export const getPickingList = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 50,
      warehouseId,
      search,
      source,
      brand,
      category,
      batchId
    } = req.query;

    if (!warehouseId) {
      return res.status(400).json({ error: 'Warehouse ID required' });
    }

    const offset = (Number(page) - 1) * Number(limit);
    const conditions: string[] = ['p.warehouse_id = $1'];
    const params: any[] = [warehouseId];
    let paramIndex = 2;

    if (search) {
      conditions.push(`(p.wsn ILIKE $${paramIndex} OR m.product_title ILIKE $${paramIndex} OR m.brand ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (source) {
      conditions.push(`p.source = $${paramIndex}`);
      params.push(source);
      paramIndex++;
    }

    if (brand) {
      conditions.push(`m.brand ILIKE $${paramIndex}`);
      params.push(`%${brand}%`);
      paramIndex++;
    }

    if (category) {
      conditions.push(`m.cms_vertical ILIKE $${paramIndex}`);
      params.push(`%${category}%`);
      paramIndex++;
    }

    if (batchId) {
      conditions.push(`p.batch_id = $${paramIndex}`);
      params.push(batchId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const countSql = `
      SELECT COUNT(*) 
      FROM picking p 
      LEFT JOIN master_data m ON p.wsn = m.wsn
      WHERE ${whereClause}
    `;
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0].count);

    // Data query with ALL master_data columns
    const dataSql = `
      SELECT 
        p.id, p.picking_date, p.picker_name, p.customer_name, p.wsn, 
        p.picking_remarks, p.quantity, p.source, p.batch_id, p.warehouse_id, 
        p.warehouse_name, p.other_remarks, p.rack_no, p.created_user_name,
        m.product_title, m.brand, m.cms_vertical, m.mrp, m.fsp,
        m.wid, m.fsn, m.order_id, m.hsn_sac, m.igst_rate, 
        m.p_type, m.p_size, m.vrp, m.yield_value, m.wh_location,
        m.fkqc_remark, m.fk_grade, m.invoice_date, m.fkt_link
      FROM picking p 
      LEFT JOIN master_data m ON p.wsn = m.wsn
      WHERE ${whereClause}
      ORDER BY p.id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(Number(limit), offset);
    const dataResult = await query(dataSql, params);

    res.json({
      data: dataResult.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: any) {
    console.error('Get picking list error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====== GET CUSTOMERS - SIMPLE STRING ARRAY (EXACTLY LIKE OUTBOUND) ======
export const getCustomers = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.query;

    if (!warehouseId) {
      return res.status(400).json({ error: 'Warehouse ID required' });
    }

    let sql = `
      SELECT DISTINCT customer_name
      FROM picking
      WHERE warehouse_id = $1 AND customer_name IS NOT NULL AND customer_name != ''
      ORDER BY customer_name ASC
      LIMIT 100
    `;

    let result = await query(sql, [warehouseId]);

    // RETURN SIMPLE STRING ARRAY (SAME AS OUTBOUND)
    const customerNames = result.rows.map((r: any) => r.customer_name);

    res.json(customerNames);
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
      details: error.stack
    });
  }
};


// ====== CHECK WSN EXISTS ======
export const checkWSNExists = async (req: Request, res: Response) => {
  try {
    const { wsn, warehouseId } = req.query;

    if (!wsn || !warehouseId) {
      return res.status(400).json({ error: 'WSN and warehouse ID required' });
    }

    const sql = `SELECT COUNT(*) as count FROM picking WHERE wsn = $1 AND warehouse_id = $2`;
    const result = await query(sql, [wsn, warehouseId]);

    res.json({
      exists: parseInt(result.rows[0].count) > 0
    });
  } catch (error: any) {
    console.error('Check WSN exists error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====== GET ALL EXISTING WSNs FOR DUPLICATE CHECK ======
export const getExistingWSNs = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.query;

    if (!warehouseId) {
      return res.status(400).json({ error: 'Warehouse ID required' });
    }

    const sql = `SELECT DISTINCT UPPER(TRIM(wsn)) as wsn FROM picking`;
    const result = await query(sql);

    res.json(result.rows.map((r: any) => r.wsn));
  } catch (error: any) {
    console.error('Get existing WSNs error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====== GET BATCHES ======
export const getBatches = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.query;

    if (!warehouseId) {
      return res.status(400).json({ error: 'Warehouse ID required' });
    }

    const sql = `
      SELECT 
        batch_id,
        COUNT(*) as count,
        COALESCE(MAX(created_at), MAX(picking_date)) as created_at,
        MIN(id) as id
      FROM picking
      WHERE warehouse_id = $1 AND batch_id IS NOT NULL
      GROUP BY batch_id
      ORDER BY COALESCE(MAX(created_at), MAX(picking_date)) DESC
    `;

    const result = await query(sql, [warehouseId]);

    // Normalize created_at to ISO string when possible for consistent frontend formatting
    const rows = result.rows.map((r: any) => ({
      ...r,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null
    }));

    res.json(rows);
  } catch (error: any) {
    console.error('Get batches error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====== DELETE BATCH ======
export const deleteBatch = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      return res.status(400).json({ error: 'Batch ID required' });
    }

    const sql = `DELETE FROM picking WHERE batch_id = $1 RETURNING *`;
    const result = await query(sql, [batchId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    res.json({
      message: 'Batch deleted successfully',
      deletedCount: result.rows.length
    });
  } catch (error: any) {
    console.error('Delete batch error:', error);
    res.status(500).json({ error: error.message });
  }
};