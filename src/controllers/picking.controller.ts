import { Request, Response } from 'express';
import { query } from '../config/database';

// ====== GET SOURCE DATA BY WSN (QC → INBOUND → MASTER) ======
export const getSourceByWSN = async (req: Request, res: Response) => {
  try {
    const { wsn, warehouseId } = req.query;
    
    if (!wsn || !warehouseId) {
      return res.status(400).json({ error: 'WSN and warehouse ID required' });
    }

    // Priority 1: Check QC
    let sql = `SELECT q.*, 'QC' as source FROM qc q WHERE q.wsn = $1 AND q.warehouse_id = $2 LIMIT 1`;
    let result = await query(sql, [wsn, warehouseId]);
    
    if (result.rows.length === 0) {
      // Priority 2: Check Inbound
      sql = `SELECT i.*, 'INBOUND' as source FROM inbound i WHERE i.wsn = $1 AND i.warehouse_id = $2 LIMIT 1`;
      result = await query(sql, [wsn, warehouseId]);
      
      if (result.rows.length === 0) {
        // Priority 3: Check Master Data
        sql = `SELECT m.*, 'MASTER' as source FROM master_data m WHERE m.wsn = $1 LIMIT 1`;
        result = await query(sql, [wsn]);
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'WSN not found in any table' });
        }
      }
    }

    res.json(result.rows[0]);
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
            picking_date, customer_name, picker_name, wsn, 
            product_title, brand, cms_vertical, fsp, mrp, rack_no,
            wid, fsn, order_id, fkqc_remark, fk_grade, hsn_sac, igst_rate,
            invoice_date, fkt_link, wh_location, vrp, yield_value, p_type, p_size,
            picking_remarks, warehouse_id, warehouse_name, batch_id, source, 
            created_at, created_by, created_user_name
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, NOW(), $30, $31
          )
        `;
        
        await query(sql, [
          entry.picking_date || null,
          entry.customer_name || null,
          entry.picker_name || null,
          entry.wsn,
          entry.product_title || null,
          entry.brand || null,
          entry.cms_vertical || null,
          entry.fsp || null,
          entry.mrp || null,
          entry.rack_no || null,
          entry.wid || null,
          entry.fsn || null,
          entry.order_id || null,
          entry.fkqc_remark || null,
          entry.fk_grade || null,
          entry.hsn_sac || null,
          entry.igst_rate || null,
          entry.invoice_date || null,
          entry.fkt_link || null,
          entry.wh_location || null,
          entry.vrp || null,
          entry.yield_value || null,
          entry.p_type || null,
          entry.p_size || null,
          entry.picking_remarks || null,
          warehouse_id,
          entry.warehouse_name || null,
          batchId,
          entry.source || 'MANUAL',
          entry.created_by || null,
          entry.created_user_name || null
        ]);
        
        successCount++;
      } catch (err: any) {
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
    const conditions: string[] = ['warehouse_id = $1'];
    const params: any[] = [warehouseId];
    let paramIndex = 2;

    if (search) {
      conditions.push(`(wsn ILIKE $${paramIndex} OR product_title ILIKE $${paramIndex} OR brand ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (source) {
      conditions.push(`source = $${paramIndex}`);
      params.push(source);
      paramIndex++;
    }

    if (brand) {
      conditions.push(`brand ILIKE $${paramIndex}`);
      params.push(`%${brand}%`);
      paramIndex++;
    }

    if (category) {
      conditions.push(`cms_vertical ILIKE $${paramIndex}`);
      params.push(`%${category}%`);
      paramIndex++;
    }

    if (batchId) {
      conditions.push(`batch_id = $${paramIndex}`);
      params.push(batchId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const countSql = `SELECT COUNT(*) FROM picking WHERE ${whereClause}`;
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0].count);

    const dataSql = `
      SELECT * FROM picking 
      WHERE ${whereClause}
      ORDER BY created_at DESC
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

    console.log('===== GET CUSTOMERS REQUEST =====');
    console.log('Warehouse ID:', warehouseId);

    if (!warehouseId) {
      console.log('ERROR: Warehouse ID missing');
      return res.status(400).json({ error: 'Warehouse ID required' });
    }

    // STEP 1: Try customers table (like outbound does)
    console.log('Step 1: Query customers table...');
    let sql = `
      SELECT DISTINCT customer_name
      FROM picking
      WHERE warehouse_id = $1 AND customer_name IS NOT NULL AND customer_name != ''
      ORDER BY customer_name ASC
      LIMIT 100
    `;

    console.log('SQL:', sql);
    console.log('Params:', [warehouseId]);

    let result = await query(sql, [warehouseId]);

    console.log('Result rows:', result.rows.length);
    console.log('Data:', result.rows);

    // RETURN SIMPLE STRING ARRAY (SAME AS OUTBOUND)
    const customerNames = result.rows.map((r: any) => r.customer_name);

    console.log('Final customer names:', customerNames);
    console.log('===== SUCCESS =====');

    res.json(customerNames);
  } catch (error: any) {
    console.error('===== ERROR IN GET CUSTOMERS =====');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error:', error);

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

    const sql = `SELECT DISTINCT wsn FROM picking WHERE warehouse_id = $1`;
    const result = await query(sql, [warehouseId]);
    
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
        MIN(created_at) as created_at
      FROM picking
      WHERE warehouse_id = $1 AND batch_id IS NOT NULL
      GROUP BY batch_id
      ORDER BY created_at DESC
    `;
    
    const result = await query(sql, [warehouseId]);
    res.json(result.rows);
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