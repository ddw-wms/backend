// File Path = warehouse-backend/src/controllers/outbound.controller.ts
import { Request, Response } from 'express';
import { query } from '../config/database';
import { generateBatchId } from '../utils/helpers';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import fs from 'fs';

// ====== GET ALL EXISTING OUTBOUND WSNs (for duplicate checking) ======
export const getAllOutboundWSNs = async (req: Request, res: Response) => {
  try {
    const result = await query(
      "SELECT DISTINCT UPPER(TRIM(wsn)) as wsn FROM outbound WHERE wsn IS NOT NULL AND wsn != '' ORDER BY wsn"
    );
    const wsns = result.rows.map((row: any) => row.wsn);
    res.json(wsns);
  } catch (error: any) {
    console.error('❌ Error fetching all outbound WSNs:', error);
    res.status(500).json({ error: 'Failed to fetch outbound WSNs' });
  }
};

// ====== GET PENDING WSNs FOR OUTBOUND (from PICKING/QC) ======
export const getPendingForOutbound = async (req: Request, res: Response) => {
  try {
    const { warehouseId, search } = req.query;

    let sql = `
      SELECT 
        p.id, p.wsn, p.picked_date, p.rack_no, p.picked_by_name,
        m.product_title, m.brand, m.mrp, m.fsp,
        'PICKING' as source
      FROM picking p
      LEFT JOIN master_data m ON p.wsn = m.wsn
      WHERE NOT EXISTS (SELECT 1 FROM outbound WHERE outbound.wsn = p.wsn)
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (warehouseId) {
      sql += ` AND p.warehouse_id = $${paramIndex}`;
      params.push(warehouseId);
      paramIndex++;
    }

    if (search) {
      sql += ` AND p.wsn = $${paramIndex}`;
      params.push(search);
      paramIndex++;
    }

    sql += `
      UNION ALL
      SELECT 
        q.id, q.wsn, q.qc_date as picked_date, q.rack_no, q.qc_by_name as picked_by_name,
        m.product_title, m.brand, m.mrp, m.fsp,
        'QC' as source
      FROM qc q
      LEFT JOIN master_data m ON q.wsn = m.wsn
      WHERE NOT EXISTS (SELECT 1 FROM outbound WHERE outbound.wsn = q.wsn)
        AND NOT EXISTS (SELECT 1 FROM picking WHERE picking.wsn = q.wsn)
    `;

    if (warehouseId) {
      sql += ` AND q.warehouse_id = $${paramIndex}`;
      params.push(warehouseId);
      paramIndex++;
    }

    if (search) {
      sql += ` AND q.wsn = $${paramIndex}`;
      params.push(search);
      paramIndex++;
    }

    sql += ` ORDER BY picked_date DESC LIMIT 1000`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('❌ Pending outbound error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====== GET SOURCE BY WSN (PICKING → QC → INBOUND) ======
export const getSourceByWSN = async (req: Request, res: Response) => {
  try {
    const { wsn, warehouseId } = req.query;

    if (!wsn || !warehouseId) {
      return res.status(400).json({ error: 'WSN and warehouse ID required' });
    }

    // Check if already dispatched
    const dispatchedCheck = await query(
      'SELECT id, dispatch_date, customer_name FROM outbound WHERE wsn = $1 AND warehouse_id = $2 LIMIT 1',
      [wsn, warehouseId]
    );

    if (dispatchedCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'WSN already dispatched',
        existingData: dispatchedCheck.rows[0],
        canUpdate: true
      });
    }

    // 1. Check PICKING TABLE first
    let sql = `
      SELECT 
        p.*,
        m.wid, m.fsn, m.order_id, m.fkqc_remark, m.fk_grade, m.product_title,
        m.hsn_sac, m.igst_rate, m.fsp, m.mrp, m.invoice_date, m.fkt_link,
        m.wh_location, m.brand, m.cms_vertical, m.vrp, m.yield_value, m.p_type, m.p_size,
        'PICKING' as source
      FROM picking p
      LEFT JOIN master_data m ON p.wsn = m.wsn
      WHERE p.wsn = $1 AND p.warehouse_id = $2
      LIMIT 1
    `;
    let result = await query(sql, [wsn, warehouseId]);

    if (result.rows.length === 0) {
      // 2. Check QC TABLE
      sql = `
        SELECT 
          q.*,
          m.wid, m.fsn, m.order_id, m.fkqc_remark, m.fk_grade, m.product_title,
          m.hsn_sac, m.igst_rate, m.fsp, m.mrp, m.invoice_date, m.fkt_link,
          m.wh_location, m.brand, m.cms_vertical, m.vrp, m.yield_value, m.p_type, m.p_size,
          i.inbound_date, i.vehicle_no as inbound_vehicle_no, i.unload_remarks,
          'QC' as source
        FROM qc q
        LEFT JOIN master_data m ON q.wsn = m.wsn
        LEFT JOIN inbound i ON q.wsn = i.wsn
        WHERE q.wsn = $1 AND q.warehouse_id = $2
        LIMIT 1
      `;
      result = await query(sql, [wsn, warehouseId]);

      if (result.rows.length === 0) {
        // 3. Check INBOUND TABLE
        sql = `
          SELECT 
            i.*,
            m.wid, m.fsn, m.order_id, m.fkqc_remark, m.fk_grade, m.product_title,
            m.hsn_sac, m.igst_rate, m.fsp, m.mrp, m.invoice_date, m.fkt_link,
            m.wh_location, m.brand, m.cms_vertical, m.vrp, m.yield_value, m.p_type, m.p_size,
            'INBOUND' as source
          FROM inbound i
          LEFT JOIN master_data m ON i.wsn = m.wsn
          WHERE i.wsn = $1 AND i.warehouse_id = $2
          LIMIT 1
        `;
        result = await query(sql, [wsn, warehouseId]);

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'WSN not found in Picking, QC or Inbound' });
        }
      }
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('❌ Get source by WSN error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
};

// ====== CREATE SINGLE OUTBOUND ENTRY ======
export const createSingleEntry = async (req: Request, res: Response) => {
  try {
    const {
      wsn,
      dispatch_date,
      customer_name,
      vehicle_no,
      dispatch_remarks,
      other_remarks,
      warehouse_id,
      update_existing
    } = req.body;

    const userId = (req as any).user?.id;
    const userName = (req as any).user?.full_name ||
      (req as any).user?.name ||
      (req as any).user?.username ||
      'Unknown';

    console.log('📦 Creating single outbound entry:', { wsn, warehouse_id });

    // Check if WSN already dispatched
    const checkSql = `SELECT id, warehouse_id FROM outbound WHERE wsn = $1 LIMIT 1`;
    const checkResult = await query(checkSql, [wsn]);

    if (checkResult.rows.length > 0) {
      const existingWarehouse = checkResult.rows[0].warehouse_id;

      if (existingWarehouse !== Number(warehouse_id)) {
        return res.status(403).json({
          error: 'WSN already dispatched from different warehouse.',
          existingWarehouseId: existingWarehouse
        });
      }

      if (!update_existing) {
        return res.status(409).json({
          error: 'Duplicate WSN - already dispatched',
          existingId: checkResult.rows[0].id,
          canUpdate: true
        });
      }

      // Update existing outbound entry
      const updateSql = `
        UPDATE outbound 
        SET dispatch_date = $1,
            customer_name = $2,
            vehicle_no = $3,
            dispatch_remarks = $4,
            other_remarks = $5
        WHERE id = $6
        RETURNING id, dispatch_date, customer_name, wsn, vehicle_no, dispatch_remarks, 
                  other_remarks, quantity, source, warehouse_id, warehouse_name, 
                  created_user_name, batch_id
      `;
      const updateResult = await query(updateSql, [
        dispatch_date,
        customer_name,
        vehicle_no,
        dispatch_remarks,
        other_remarks,
        checkResult.rows[0].id
      ]);

      console.log('✅ Outbound entry updated');
      return res.json({ ...updateResult.rows[0], action: 'updated' });
    }

    // Get warehouse name
    const whSql = `SELECT name FROM warehouses WHERE id = $1`;
    const whResult = await query(whSql, [warehouse_id]);
    const warehouseName = whResult.rows[0]?.name || '';

    // Fetch source data (PICKING → QC → INBOUND)
    let sourceData: any = null;
    let sourceType = '';

    // Check PICKING
    let sourceSql = `
      SELECT 
        p.*,
        m.wid, m.fsn, m.order_id, m.fkqc_remark, m.fk_grade, m.product_title,
        m.hsn_sac, m.igst_rate, m.fsp, m.mrp, m.invoice_date, m.fkt_link,
        m.wh_location, m.brand, m.cms_vertical, m.vrp, m.yield_value, m.p_type, m.p_size,
        'PICKING' as source
      FROM picking p
      LEFT JOIN master_data m ON p.wsn = m.wsn
      WHERE p.wsn = $1 AND p.warehouse_id = $2
      LIMIT 1
    `;
    let sourceResult = await query(sourceSql, [wsn, warehouse_id]);

    if (sourceResult.rows.length > 0) {
      sourceData = sourceResult.rows[0];
      sourceType = 'PICKING';
    } else {
      // Check QC
      sourceSql = `
        SELECT 
          q.*,
          m.wid, m.fsn, m.order_id, m.fkqc_remark, m.fk_grade, m.product_title,
          m.hsn_sac, m.igst_rate, m.fsp, m.mrp, m.invoice_date, m.fkt_link,
          m.wh_location, m.brand, m.cms_vertical, m.vrp, m.yield_value, m.p_type, m.p_size,
          i.inbound_date, i.vehicle_no as inbound_vehicle_no, i.unload_remarks,
          'QC' as source
        FROM qc q
        LEFT JOIN master_data m ON q.wsn = m.wsn
        LEFT JOIN inbound i ON q.wsn = i.wsn
        WHERE q.wsn = $1 AND q.warehouse_id = $2
        LIMIT 1
      `;
      sourceResult = await query(sourceSql, [wsn, warehouse_id]);

      if (sourceResult.rows.length > 0) {
        sourceData = sourceResult.rows[0];
        sourceType = 'QC';
      } else {
        // Check INBOUND
        sourceSql = `
          SELECT 
            i.*,
            m.wid, m.fsn, m.order_id, m.fkqc_remark, m.fk_grade, m.product_title,
            m.hsn_sac, m.igst_rate, m.fsp, m.mrp, m.invoice_date, m.fkt_link,
            m.wh_location, m.brand, m.cms_vertical, m.vrp, m.yield_value, m.p_type, m.p_size,
            'INBOUND' as source
          FROM inbound i
          LEFT JOIN master_data m ON i.wsn = m.wsn
          WHERE i.wsn = $1 AND i.warehouse_id = $2
          LIMIT 1
        `;
        sourceResult = await query(sourceSql, [wsn, warehouse_id]);

        if (sourceResult.rows.length === 0) {
          return res.status(404).json({ error: 'WSN not found in Picking, QC or Inbound' });
        }

        sourceData = sourceResult.rows[0];
        sourceType = 'INBOUND';
      }
    }

    // Insert into outbound with only existing columns
    const insertSql = `
      INSERT INTO outbound (
        dispatch_date, customer_name, wsn, vehicle_no, dispatch_remarks, other_remarks,
        quantity, source, warehouse_id, warehouse_name, created_user_name
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      RETURNING *
    `;

    const result = await query(insertSql, [
      dispatch_date,
      customer_name,
      wsn,
      vehicle_no || null,
      dispatch_remarks || null,
      other_remarks || null,
      1,
      sourceType,
      warehouse_id,
      warehouseName,
      userName
    ]);

    console.log('✅ Single outbound entry created');
    res.status(201).json({ ...result.rows[0], action: 'created' });
  } catch (error: any) {
    console.error('❌ Create outbound error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====== MULTI OUTBOUND ENTRY (WITH BATCH ID) ======
export const multiEntry = async (req: Request, res: Response) => {
  try {
    const { entries, warehouse_id } = req.body;
    const userId = (req as any).user?.id;
    const userName = (req as any).user?.full_name ||
      (req as any).user?.name ||
      (req as any).user?.username ||
      'Unknown';

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

      // Fetch source data
      let sourceData: any = null;
      let sourceType = '';

      // Check PICKING
      let sourceSql = `
        SELECT 
          p.*,
          m.wid, m.fsn, m.order_id, m.fkqc_remark, m.fk_grade, m.product_title,
          m.hsn_sac, m.igst_rate, m.fsp, m.mrp, m.invoice_date, m.fkt_link,
          m.wh_location, m.brand, m.cms_vertical, m.vrp, m.yield_value, m.p_type, m.p_size
        FROM picking p
        LEFT JOIN master_data m ON p.wsn = m.wsn
        WHERE p.wsn = $1 AND p.warehouse_id = $2
        LIMIT 1
      `;
      let sourceResult = await query(sourceSql, [wsn, warehouse_id]);

      if (sourceResult.rows.length > 0) {
        sourceData = sourceResult.rows[0];
        sourceType = 'PICKING';
      } else {
        // Check QC
        sourceSql = `
          SELECT 
            q.*,
            m.wid, m.fsn, m.order_id, m.fkqc_remark, m.fk_grade, m.product_title,
            m.hsn_sac, m.igst_rate, m.fsp, m.mrp, m.invoice_date, m.fkt_link,
            m.wh_location, m.brand, m.cms_vertical, m.vrp, m.yield_value, m.p_type, m.p_size,
            i.inbound_date, i.vehicle_no as inbound_vehicle_no, i.unload_remarks
          FROM qc q
          LEFT JOIN master_data m ON q.wsn = m.wsn
          LEFT JOIN inbound i ON q.wsn = i.wsn
          WHERE q.wsn = $1 AND q.warehouse_id = $2
          LIMIT 1
        `;
        sourceResult = await query(sourceSql, [wsn, warehouse_id]);

        if (sourceResult.rows.length > 0) {
          sourceData = sourceResult.rows[0];
          sourceType = 'QC';
        } else {
          // Check INBOUND
          sourceSql = `
            SELECT 
              i.*,
              m.wid, m.fsn, m.order_id, m.fkqc_remark, m.fk_grade, m.product_title,
              m.hsn_sac, m.igst_rate, m.fsp, m.mrp, m.invoice_date, m.fkt_link,
              m.wh_location, m.brand, m.cms_vertical, m.vrp, m.yield_value, m.p_type, m.p_size
            FROM inbound i
            LEFT JOIN master_data m ON i.wsn = m.wsn
            WHERE i.wsn = $1 AND i.warehouse_id = $2
            LIMIT 1
          `;
          sourceResult = await query(sourceSql, [wsn, warehouse_id]);

          if (sourceResult.rows.length === 0) {
            results.push({ wsn, status: 'NOT_FOUND', message: 'WSN not found in Picking/QC/Inbound' });
            continue;
          }

          sourceData = sourceResult.rows[0];
          sourceType = 'INBOUND';
        }
      }

      const sql = `
        INSERT INTO outbound (
          dispatch_date, customer_name, wsn, vehicle_no, dispatch_remarks, other_remarks,
          quantity, source, warehouse_id, warehouse_name, batch_id, created_user_name
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
      `;

      await query(sql, [
        entry.dispatch_date,
        entry.customer_name,
        wsn,
        entry.vehicle_no,
        entry.dispatch_remarks,
        entry.other_remarks,
        entry.quantity || 1,
        sourceType,
        warehouse_id,
        warehouseName,
        batchId,
        userName
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
    console.error('❌ Multi Entry ERROR:', error);
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
    const userName = (req as any).user?.full_name ||
      (req as any).user?.name ||
      (req as any).user?.username ||
      'Unknown';

    // Get warehouse name
    const whSql = `SELECT name FROM warehouses WHERE id = $1`;
    const whResult = await query(whSql, [warehouseId]);
    const warehouseName = whResult.rows[0]?.name || '';

    // Read Excel file using ExcelJS for safer server-side parsing
    const workbook = new ExcelJS.Workbook();
    await (workbook.xlsx as any).load(req.file.buffer);
    const worksheet = workbook.worksheets[0];

    const data: any[] = [];
    const headers: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
      const values = row.values as any[];
      if (rowNumber === 1) {
        for (let i = 1; i < values.length; i++) {
          headers.push(String(values[i] ?? '').trim());
        }
      } else {
        const obj: any = {};
        for (let i = 1; i < values.length; i++) {
          obj[headers[i - 1] || `col_${i}`] = values[i];
        }
        data.push(obj);
      }
    });

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
      let sourceSql = `
        SELECT 
          p.*,
          m.wid, m.fsn, m.order_id, m.fkqc_remark, m.fk_grade, m.product_title,
          m.hsn_sac, m.igst_rate, m.fsp, m.mrp, m.invoice_date, m.fkt_link,
          m.wh_location, m.brand, m.cms_vertical, m.vrp, m.yield_value, m.p_type, m.p_size
        FROM picking p
        LEFT JOIN master_data m ON p.wsn = m.wsn
        WHERE p.wsn = $1 AND p.warehouse_id = $2
        LIMIT 1
      `;
      let sourceResult = await query(sourceSql, [wsn, warehouseId]);

      if (sourceResult.rows.length > 0) {
        sourceData = sourceResult.rows[0];
        sourceType = 'PICKING';
      } else {
        // Check QC
        sourceSql = `
          SELECT 
            q.*,
            m.wid, m.fsn, m.order_id, m.fkqc_remark, m.fk_grade, m.product_title,
            m.hsn_sac, m.igst_rate, m.fsp, m.mrp, m.invoice_date, m.fkt_link,
            m.wh_location, m.brand, m.cms_vertical, m.vrp, m.yield_value, m.p_type, m.p_size,
            i.inbound_date, i.vehicle_no as inbound_vehicle_no, i.unload_remarks
          FROM qc q
          LEFT JOIN master_data m ON q.wsn = m.wsn
          LEFT JOIN inbound i ON q.wsn = i.wsn
          WHERE q.wsn = $1 AND q.warehouse_id = $2
          LIMIT 1
        `;
        sourceResult = await query(sourceSql, [wsn, warehouseId]);

        if (sourceResult.rows.length > 0) {
          sourceData = sourceResult.rows[0];
          sourceType = 'QC';
        } else {
          // Check INBOUND
          sourceSql = `
            SELECT 
              i.*,
              m.wid, m.fsn, m.order_id, m.fkqc_remark, m.fk_grade, m.product_title,
              m.hsn_sac, m.igst_rate, m.fsp, m.mrp, m.invoice_date, m.fkt_link,
              m.wh_location, m.brand, m.cms_vertical, m.vrp, m.yield_value, m.p_type, m.p_size
            FROM inbound i
            LEFT JOIN master_data m ON i.wsn = m.wsn
            WHERE i.wsn = $1 AND i.warehouse_id = $2
            LIMIT 1
          `;
          sourceResult = await query(sourceSql, [wsn, warehouseId]);

          if (sourceResult.rows.length === 0) {
            errors.push({ wsn, error: 'WSN not found in Picking/QC/Inbound' });
            continue;
          }

          sourceData = sourceResult.rows[0];
          sourceType = 'INBOUND';
        }
      }

      // Insert into outbound
      const insertSql = `
        INSERT INTO outbound (
          dispatch_date, customer_name, wsn, vehicle_no, dispatch_remarks, other_remarks,
          quantity, source, warehouse_id, warehouse_name, batch_id, created_user_name
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
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
        batchId,
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
    console.error('❌ Bulk upload error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====== GET OUTBOUND LIST ======
export const getList = async (req: Request, res: Response) => {
  try {
    //console.log('📋 getList called with params:', req.query);

    const {
      page = 1,
      limit = 100,
      search = '',
      warehouseId,
      source = '',
      customer = '',
      startDate = '',
      endDate = '',
      batchId = '',
      brand = '',
      category = ''
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
      // Broaden search to include master_data columns so typing any product/brand/wsn/order will match
      whereConditions.push(`(
        o.wsn ILIKE $${paramIndex} OR
        o.customer_name ILIKE $${paramIndex} OR
        o.vehicle_no ILIKE $${paramIndex} OR
        o.batch_id ILIKE $${paramIndex} OR
        m.product_title ILIKE $${paramIndex} OR
        m.brand ILIKE $${paramIndex} OR
        m.cms_vertical ILIKE $${paramIndex} OR
        m.fsn ILIKE $${paramIndex} OR
        m.order_id ILIKE $${paramIndex}
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

    if (brand) {
      whereConditions.push(`m.brand ILIKE $${paramIndex}`);
      params.push(`%${brand}%`);
      paramIndex++;
    }

    if (category) {
      whereConditions.push(`m.cms_vertical ILIKE $${paramIndex}`);
      params.push(`%${category}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    //console.log('📊 SQL params:', params);
    //console.log('📊 WHERE clause:', whereClause);

    const countSql = `
      SELECT COUNT(*) as total 
      FROM outbound o 
      LEFT JOIN master_data m ON o.wsn = m.wsn
      ${whereClause}
    `;
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0].total);

    const dataSql = `
      SELECT 
        o.*,
        m.product_title,
        m.brand,
        m.cms_vertical,
        m.wid,
        m.fsn,
        m.order_id,
        m.fkqc_remark,
        m.fk_grade,
        m.hsn_sac,
        m.igst_rate,
        m.fsp,
        m.mrp,
        m.vrp,
        m.yield_value,
        m.invoice_date,
        m.fkt_link,
        m.wh_location,
        m.p_type,
        m.p_size
      FROM outbound o
      LEFT JOIN master_data m ON o.wsn = m.wsn
      ${whereClause}
      ORDER BY o.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // console.log('📊 Final SQL:', dataSql);
    // console.log('📊 Limit:', limit, 'Offset:', offset);

    const result = await query(dataSql, params);

    res.json({
      data: result.rows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (error: any) {
    console.error('❌ Get outbound list error:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
};

// ====== GET CUSTOMERS ======
export const getCustomers = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.query;

    //console.log('===== GET CUSTOMERS REQUEST =====');
    //console.log('Warehouse ID:', warehouseId);

    if (!warehouseId) {
      console.log('ERROR: Warehouse ID missing');
      return res.status(400).json({ error: 'Warehouse ID required' });
    }

    // Return only customers that appear in outbound entries for this warehouse
    const sql = `
      SELECT DISTINCT customer_name
      FROM outbound
      WHERE warehouse_id = $1 AND customer_name IS NOT NULL AND customer_name != ''
      ORDER BY customer_name ASC
    `;

    const result = await query(sql, [warehouseId]);

    const customerNames = result.rows.map((r: any) => r.customer_name);

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

// ====== GET EXISTING WSNs ======
export const getExistingWSNs = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.query;
    const sql = `SELECT DISTINCT wsn FROM outbound WHERE warehouse_id = $1`;
    const result = await query(sql, [warehouseId]);
    res.json(result.rows.map((r: any) => r.wsn));
  } catch (error: any) {
    console.error('❌ Get existing WSNs error:', error);
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
        MAX(dispatch_date) as last_updated
      FROM outbound
      WHERE warehouse_id = $1 AND batch_id IS NOT NULL
      GROUP BY batch_id
      ORDER BY MAX(dispatch_date) DESC
    `;
    const result = await query(sql, [warehouseId]);
    res.json(result.rows);
  } catch (error: any) {
    console.error('❌ Get batches error:', error);
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
    console.error('❌ Delete batch error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====== EXPORT TO EXCEL ======
export const exportToExcel = async (req: Request, res: Response) => {
  try {
    const {
      warehouseId,
      source = '',
      customer = '',
      startDate = '',
      endDate = '',
      batchId = ''
    } = req.query;

    let whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (warehouseId) {
      whereConditions.push(`o.warehouse_id = $${paramIndex}`);
      params.push(warehouseId);
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

    const sql = `
      SELECT 
        o.*,
        m.product_title,
        m.brand,
        m.cms_vertical,
        m.wid,
        m.fsn,
        m.order_id,
        m.fkqc_remark,
        m.fk_grade,
        m.hsn_sac,
        m.igst_rate,
        m.fsp,
        m.mrp,
        m.vrp,
        m.yield_value,
        m.invoice_date,
        m.fkt_link,
        m.wh_location,
        m.p_type,
        m.p_size
      FROM outbound o
      LEFT JOIN master_data m ON o.wsn = m.wsn
      ${whereClause}
      ORDER BY o.dispatch_date DESC, o.id DESC
    `;

    const result = await query(sql, params);

    // Create Excel file
    const worksheet = XLSX.utils.json_to_sheet(result.rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Outbound');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=outbound_export.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error: any) {
    console.error('❌ Export error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// GET BRANDS - from master_data
// ============================================
export const getBrands = async (req: Request, res: Response) => {
  try {
    const { warehouse_id } = req.query;

    let sql = `
      SELECT DISTINCT m.brand 
      FROM outbound o
      LEFT JOIN master_data m ON o.wsn = m.wsn
      WHERE m.brand IS NOT NULL AND m.brand != ''
    `;

    const params: any[] = [];

    if (warehouse_id) {
      sql += ` AND o.warehouse_id = $1`;
      params.push(warehouse_id);
    }

    sql += ` ORDER BY m.brand`;

    const result = await query(sql, params);
    res.json(result.rows.map((r: any) => r.brand));
  } catch (error: any) {
    console.error('❌ Get brands error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// GET CATEGORIES - from master_data
// ============================================
export const getCategories = async (req: Request, res: Response) => {
  try {
    const { warehouse_id } = req.query;

    let sql = `
      SELECT DISTINCT m.cms_vertical 
      FROM outbound o
      LEFT JOIN master_data m ON o.wsn = m.wsn
      WHERE m.cms_vertical IS NOT NULL AND m.cms_vertical != ''
    `;

    const params: any[] = [];

    if (warehouse_id) {
      sql += ` AND o.warehouse_id = $1`;
      params.push(warehouse_id);
    }

    sql += ` ORDER BY m.cms_vertical`;

    const result = await query(sql, params);
    res.json(result.rows.map((r: any) => r.cms_vertical));
  } catch (error: any) {
    console.error('❌ Get categories error:', error);
    res.status(500).json({ error: error.message });
  }
};
