import { Request, Response } from 'express';
import { query } from '../config/database';
import { generateBatchId } from '../utils/helpers';
import * as XLSX from 'xlsx';

// ====== GET SOURCE BY WSN (PICKING → QC → INBOUND) ======
export const getSourceByWSN = async (req: Request, res: Response) => {
  try {
    const { wsn, warehouseId } = req.query;
    
    if (!wsn || !warehouseId) {
      return res.status(400).json({ error: 'WSN and warehouse ID required' });
    }

    // 1. Check PICKING TABLE first
    let sql = `SELECT p.*, 'PICKING' as source FROM picking p WHERE p.wsn = $1 AND p.warehouse_id = $2 LIMIT 1`;
    let result = await query(sql, [wsn, warehouseId]);
    
    if (result.rows.length === 0) {
      // 2. Check QC TABLE
      sql = `SELECT q.*, 'QC' as source FROM qc q WHERE q.wsn = $1 AND q.warehouse_id = $2 LIMIT 1`;
      result = await query(sql, [wsn, warehouseId]);
      
      if (result.rows.length === 0) {
        // 3. Check INBOUND TABLE
        sql = `SELECT i.*, 'INBOUND' as source FROM inbound i WHERE i.wsn = $1 AND i.warehouse_id = $2 LIMIT 1`;
        result = await query(sql, [wsn, warehouseId]);
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'WSN not found in Picking, QC or Inbound' });
        }
      }
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Get source by WSN error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
};

// ====== MULTI OUTBOUND ENTRY (WITH BATCH ID) ======
export const multiEntry = async (req: Request, res: Response) => {
  try {
    const { entries, warehouse_id } = req.body;
    const userId = (req as any).user?.id;
    const userName = (req as any).user?.fullName || 'Unknown';

    if (!entries || entries.length === 0) {
      return res.status(400).json({ error: 'No entries provided' });
    }

    // Get warehouse name
    const whSql = `SELECT name FROM warehouses WHERE id = $1`;
    const whResult = await query(whSql, [warehouse_id]);
    const warehouseName = whResult.rows[0]?.name || '';

    const wsns = entries.map((e: any) => e.wsn).filter(Boolean);
    
    // Check existing WSNs in outbound
    const existingMap = new Map();
    if (wsns.length > 0) {
      const checkSql = `SELECT wsn, warehouse_id FROM outbound WHERE wsn = ANY($1)`;
      const checkRes = await query(checkSql, [wsns]);
      checkRes.rows.forEach((row: any) => {
        existingMap.set(row.wsn, row.warehouse_id);
      });
    }

    // GENERATE BATCH ID - OUT_MULTI_YYYYMMDD_HHMMSS
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const batchId = `OUT_MULTI_${dateStr}_${timeStr}`;

    let successCount = 0;
    const results: any[] = [];

    for (const entry of entries) {
      const wsn = entry.wsn?.trim();
      if (!wsn) continue;

      // Duplicate check
      if (existingMap.has(wsn)) {
        results.push({ wsn, status: 'DUPLICATE', message: 'WSN already dispatched' });
        continue;
      }

      const sql = `
        INSERT INTO outbound (
          dispatch_date, customer_name, wsn, vehicle_no, dispatch_remarks, other_remarks,
          quantity, source, warehouse_id, warehouse_name,
          qc_date, qc_by, qc_remarks, product_serial_number,
          inbound_date, unload_remarks, rack_no,
          wid, fsn, order_id, fkqc_remark, fk_grade, product_title,
          hsn_sac, igst_rate, fsp, mrp, invoice_date, fkt_link, wh_location,
          brand, cms_vertical, vrp, yield_value, p_type, p_size,
          batch_id, created_by, created_user_name
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
          $31,$32,$33,$34,$35,$36,$37,$38,$39
        )
      `;

      await query(sql, [
        entry.dispatch_date, entry.customer_name, wsn, entry.vehicle_no, entry.dispatch_remarks, entry.other_remarks,
        entry.quantity || 1, entry.source, warehouse_id, warehouseName,
        entry.qc_date, entry.qc_by, entry.qc_remarks, entry.product_serial_number,
        entry.inbound_date, entry.unload_remarks, entry.rack_no,
        entry.wid, entry.fsn, entry.order_id, entry.fkqc_remark, entry.fk_grade, entry.product_title,
        entry.hsn_sac, entry.igst_rate, entry.fsp, entry.mrp, entry.invoice_date, entry.fkt_link, entry.wh_location,
        entry.brand, entry.cms_vertical, entry.vrp, entry.yield_value, entry.p_type, entry.p_size,
        batchId, userId, userName  // ✅ BATCH ID ADDED
      ]);

      results.push({ wsn, status: 'SUCCESS' });
      successCount++;
    }

    res.json({
      batchId,
      totalCount: entries.length,
      successCount,
      results
    });
  } catch (error: any) {
    console.error('Multi Entry ERROR:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====== BULK UPLOAD (COMPLETE IMPLEMENTATION) ======
export const bulkUpload = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const warehouseId = req.body.warehouse_id;
    const userId = (req as any).user?.id;
    const userName = (req as any).user?.fullName || 'Unknown';

    // Get warehouse name
    const whSql = `SELECT name FROM warehouses WHERE id = $1`;
    const whResult = await query(whSql, [warehouseId]);
    const warehouseName = whResult.rows[0]?.name || '';

    // Read Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ error: 'Empty file' });
    }

    // GENERATE BATCH ID - OUT_BULK_YYYYMMDD_HHMMSS
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const batchId = `OUT_BULK_${dateStr}_${timeStr}`;

    // Get all WSNs from file
    const wsns = data.map((row: any) => row.WSN || row.wsn).filter(Boolean);

    // Check existing WSNs
    const existingMap = new Map();
    if (wsns.length > 0) {
      const checkSql = `SELECT wsn FROM outbound WHERE wsn = ANY($1)`;
      const checkRes = await query(checkSql, [wsns]);
      checkRes.rows.forEach((row: any) => {
        existingMap.set(row.wsn, true);
      });
    }

    let successCount = 0;
    const errors: any[] = [];

    // Process each row
    for (const row of data) {
      const wsn = (row as any).WSN || (row as any).wsn;
      if (!wsn) {
        errors.push({ row, error: 'Missing WSN' });
        continue;
      }

      if (existingMap.has(wsn)) {
        errors.push({ wsn, error: 'Duplicate - Already dispatched' });
        continue;
      }

      // Fetch source data (PICKING → QC → INBOUND)
      let sourceData: any = null;
      let sourceType = '';

      // Check PICKING
      let sourceSql = `SELECT *, 'PICKING' as source FROM picking WHERE wsn = $1 AND warehouse_id = $2 LIMIT 1`;
      let sourceResult = await query(sourceSql, [wsn, warehouseId]);
      
      if (sourceResult.rows.length > 0) {
        sourceData = sourceResult.rows[0];
        sourceType = 'PICKING';
      } else {
        // Check QC
        sourceSql = `SELECT *, 'QC' as source FROM qc WHERE wsn = $1 AND warehouse_id = $2 LIMIT 1`;
        sourceResult = await query(sourceSql, [wsn, warehouseId]);
        
        if (sourceResult.rows.length > 0) {
          sourceData = sourceResult.rows[0];
          sourceType = 'QC';
        } else {
          // Check INBOUND
          sourceSql = `SELECT *, 'INBOUND' as source FROM inbound WHERE wsn = $1 AND warehouse_id = $2 LIMIT 1`;
          sourceResult = await query(sourceSql, [wsn, warehouseId]);
          
          if (sourceResult.rows.length > 0) {
            sourceData = sourceResult.rows[0];
            sourceType = 'INBOUND';
          } else {
            errors.push({ wsn, error: 'WSN not found in Picking/QC/Inbound' });
            continue;
          }
        }
      }

      // Insert into outbound
      const insertSql = `
        INSERT INTO outbound (
          dispatch_date, customer_name, wsn, vehicle_no, dispatch_remarks, other_remarks,
          quantity, source, warehouse_id, warehouse_name,
          qc_date, qc_by, qc_remarks, product_serial_number,
          inbound_date, unload_remarks, rack_no,
          wid, fsn, order_id, fkqc_remark, fk_grade, product_title,
          hsn_sac, igst_rate, fsp, mrp, invoice_date, fkt_link, wh_location,
          brand, cms_vertical, vrp, yield_value, p_type, p_size,
          batch_id, created_by, created_user_name
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
          $31,$32,$33,$34,$35,$36,$37,$38,$39
        )
      `;

      await query(insertSql, [
        (row as any).DISPATCH_DATE || (row as any).dispatch_date || new Date().toISOString().split('T')[0],
        (row as any).CUSTOMER_NAME || (row as any).customer_name || '',
        wsn,
        (row as any).VEHICLE_NO || (row as any).vehicle_no || '',
        (row as any).DISPATCH_REMARKS || (row as any).dispatch_remarks || '',
        (row as any).OTHER_REMARKS || (row as any).other_remarks || '',
        1,
        sourceType,
        warehouseId,
        warehouseName,
        sourceData.qc_date,
        sourceData.qc_by,
        sourceData.qc_remarks,
        sourceData.product_serial_number,
        sourceData.inbound_date,
        sourceData.unload_remarks,
        sourceData.rack_no,
        sourceData.wid,
        sourceData.fsn,
        sourceData.order_id,
        sourceData.fkqc_remark,
        sourceData.fk_grade,
        sourceData.product_title,
        sourceData.hsn_sac,
        sourceData.igst_rate,
        sourceData.fsp,
        sourceData.mrp,
        sourceData.invoice_date,
        sourceData.fkt_link,
        sourceData.wh_location,
        sourceData.brand,
        sourceData.cms_vertical,
        sourceData.vrp,
        sourceData.yield_value,
        sourceData.p_type,
        sourceData.p_size,
        batchId,
        userId,
        userName
      ]);

      successCount++;
    }

    res.json({
      batchId,
      totalRows: data.length,
      successCount,
      errorCount: errors.length,
      errors: errors.slice(0, 10), // Return first 10 errors
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====== GET OUTBOUND LIST ======
export const getList = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      warehouseId,
      source = '',
      customer = '',
      startDate = '',
      endDate = '',
      batchId = ''
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    let whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (warehouseId) {
      whereConditions.push(`o.warehouse_id = $${paramIndex}`);
      params.push(warehouseId);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(
        o.wsn ILIKE $${paramIndex} OR
        o.product_title ILIKE $${paramIndex} OR
        o.brand ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (source) {
      whereConditions.push(`o.source = $${paramIndex}`);
      params.push(source);
      paramIndex++;
    }

    if (customer) {
      whereConditions.push(`o.customer_name ILIKE $${paramIndex}`);
      params.push(`%${customer}%`);
      paramIndex++;
    }

    if (startDate) {
      whereConditions.push(`o.dispatch_date >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`o.dispatch_date <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    if (batchId) {
      whereConditions.push(`o.batch_id = $${paramIndex}`);
      params.push(batchId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const countSql = `SELECT COUNT(*) as total FROM outbound o ${whereClause}`;
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0].total);

    const dataSql = `
      SELECT o.*
      FROM outbound o
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(Number(limit), offset);

    const result = await query(dataSql, params);

    res.json({
      data: result.rows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (error: any) {
    console.error('Get outbound list error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====== GET CUSTOMERS ======
export const getCustomers = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.query;
    const sql = `
      SELECT DISTINCT customer_name
      FROM outbound
      WHERE warehouse_id = $1 AND customer_name IS NOT NULL AND customer_name != ''
      ORDER BY customer_name
    `;
    const result = await query(sql, [warehouseId]);
    res.json(result.rows.map((r: any) => r.customer_name));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ====== GET EXISTING WSNs ======
export const getExistingWSNs = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.query;
    const sql = `SELECT DISTINCT wsn FROM outbound WHERE warehouse_id = $1`;
    const result = await query(sql, [warehouseId]);
    res.json(result.rows.map((r: any) => r.wsn));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ====== GET BATCHES ======
export const getBatches = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.query;
    const sql = `
      SELECT
        batch_id,
        COUNT(*) as count,
        MAX(created_at) as last_updated
      FROM outbound
      WHERE warehouse_id = $1 AND batch_id IS NOT NULL
      GROUP BY batch_id
      ORDER BY MAX(created_at) DESC
    `;
    const result = await query(sql, [warehouseId]);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ====== DELETE BATCH ======
export const deleteBatch = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    await query('DELETE FROM outbound WHERE batch_id = $1', [batchId]);
    res.json({ message: 'Batch deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};