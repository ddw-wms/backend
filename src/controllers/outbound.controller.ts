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
// ====== BULK UPLOAD - HIGHLY OPTIMIZED for 500K-5M rows ======
export const bulkUpload = async (req: Request, res: Response) => {
  const startTime = Date.now();
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

    // Determine file type from extension or buffer signature
    const fileName = req.file.originalname?.toLowerCase() || '';
    const isCSV = fileName.endsWith('.csv') ||
      (req.file.buffer[0] !== 0x50 && req.file.buffer[1] !== 0x4B);

    const data: any[] = [];
    const headers: string[] = [];

    console.log(`📂 Parsing ${isCSV ? 'CSV' : 'Excel'} file: ${fileName}`);

    if (isCSV) {
      // Parse CSV file
      const csvContent = req.file.buffer.toString('utf-8');
      const lines = csvContent.split(/\r?\n/).filter(line => line.trim());

      if (lines.length < 2) {
        return res.status(400).json({ error: 'CSV file must have at least a header row and one data row' });
      }

      // Parse header row
      const headerLine = lines[0];
      const csvHeaders = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      csvHeaders.forEach(h => headers.push(h));

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());

        const obj: any = {};
        for (let k = 0; k < headers.length; k++) {
          obj[headers[k] || `col_${k + 1}`] = values[k] || '';
        }
        data.push(obj);
      }
    } else {
      // Read Excel file using ExcelJS
      const workbook = new ExcelJS.Workbook();
      await (workbook.xlsx as any).load(req.file.buffer);
      const worksheet = workbook.worksheets[0];

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
    }

    if (data.length === 0) {
      return res.status(400).json({ error: 'Empty file' });
    }

    console.log(`📊 Parsed ${data.length} rows in ${Date.now() - startTime}ms`);

    // GENERATE BATCH ID
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const batchId = `OUT_BULK_${dateStr}_${timeStr}`;

    // Helper function to get value with multiple possible column names
    const getValue = (row: any, ...keys: string[]): string => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          return String(row[key]).trim();
        }
      }
      return '';
    };

    // Helper function to parse date from various formats (Excel Date objects, strings, numbers)
    const parseDate = (row: any, ...keys: string[]): string => {
      for (const key of keys) {
        const val = row[key];
        if (val === undefined || val === null || val === '') continue;

        // Handle JavaScript Date objects (from ExcelJS)
        if (val instanceof Date) {
          return val.toISOString().split('T')[0]; // Returns YYYY-MM-DD
        }

        // Handle Excel serial date numbers
        if (typeof val === 'number') {
          const jsDate = new Date((val - 25569) * 86400 * 1000);
          return jsDate.toISOString().split('T')[0];
        }

        // Handle string dates
        if (typeof val === 'string') {
          const str = val.trim();

          // Already in YYYY-MM-DD format
          if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            return str;
          }

          // DD/MM/YYYY format
          if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
            const parts = str.split('/');
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }

          // MM/DD/YYYY format (US format)
          if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(str)) {
            const parts = str.split('/');
            const year = parseInt(parts[2]) > 50 ? `19${parts[2]}` : `20${parts[2]}`;
            return `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
          }

          // Try parsing as Date string (handles "Tue Jan 20 2026..." format)
          const parsed = new Date(str);
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
          }
        }
      }
      // Default to today's date if nothing found
      return new Date().toISOString().split('T')[0];
    };

    // Get all WSNs from file (normalize to uppercase)
    const wsns = data.map((row: any) => {
      const wsn = getValue(row, 'WSN', 'wsn', 'Wsn');
      return wsn ? wsn.toUpperCase().trim() : null;
    }).filter(Boolean) as string[];

    console.log(`🔍 Checking ${wsns.length} WSNs for duplicates...`);

    // BULK CHECK: Get all existing outbound WSNs in one query
    const existingSet = new Set<string>();
    if (wsns.length > 0) {
      const checkSql = `SELECT UPPER(TRIM(wsn)) as wsn FROM outbound WHERE UPPER(TRIM(wsn)) = ANY($1)`;
      const checkRes = await query(checkSql, [wsns]);
      checkRes.rows.forEach((row: any) => existingSet.add(row.wsn));
    }

    console.log(`✅ Found ${existingSet.size} existing WSNs, checking source data...`);

    // BULK FETCH: Get source data for all WSNs at once (PICKING → QC → INBOUND priority)
    const sourceMap = new Map<string, { source: string }>();

    // Fetch from PICKING in bulk
    if (wsns.length > 0) {
      const pickingSql = `SELECT UPPER(TRIM(wsn)) as wsn FROM picking WHERE UPPER(TRIM(wsn)) = ANY($1) AND warehouse_id = $2`;
      const pickingRes = await query(pickingSql, [wsns, warehouseId]);
      pickingRes.rows.forEach((row: any) => sourceMap.set(row.wsn, { source: 'PICKING' }));
    }

    // Fetch from QC in bulk (only for WSNs not in PICKING)
    const wsnsNotInPicking = wsns.filter(w => !sourceMap.has(w));
    if (wsnsNotInPicking.length > 0) {
      const qcSql = `SELECT UPPER(TRIM(wsn)) as wsn FROM qc WHERE UPPER(TRIM(wsn)) = ANY($1) AND warehouse_id = $2`;
      const qcRes = await query(qcSql, [wsnsNotInPicking, warehouseId]);
      qcRes.rows.forEach((row: any) => {
        if (!sourceMap.has(row.wsn)) sourceMap.set(row.wsn, { source: 'QC' });
      });
    }

    // Fetch from INBOUND in bulk (only for WSNs not in PICKING or QC)
    const wsnsNotInPickingOrQC = wsns.filter(w => !sourceMap.has(w));
    if (wsnsNotInPickingOrQC.length > 0) {
      const inboundSql = `SELECT UPPER(TRIM(wsn)) as wsn FROM inbound WHERE UPPER(TRIM(wsn)) = ANY($1) AND warehouse_id = $2`;
      const inboundRes = await query(inboundSql, [wsnsNotInPickingOrQC, warehouseId]);
      inboundRes.rows.forEach((row: any) => {
        if (!sourceMap.has(row.wsn)) sourceMap.set(row.wsn, { source: 'INBOUND' });
      });
    }

    console.log(`📦 Found source data for ${sourceMap.size} WSNs`);

    // Prepare data for batch insert
    const validRows: any[] = [];
    const errors: any[] = [];

    for (const row of data) {
      const wsn = getValue(row, 'WSN', 'wsn', 'Wsn').toUpperCase().trim();

      if (!wsn) {
        errors.push({ row: data.indexOf(row) + 2, error: 'Missing WSN' });
        continue;
      }

      if (existingSet.has(wsn)) {
        errors.push({ wsn, error: 'Duplicate - Already dispatched' });
        continue;
      }

      const sourceInfo = sourceMap.get(wsn);
      if (!sourceInfo) {
        errors.push({ wsn, error: 'WSN not found in Picking/QC/Inbound' });
        continue;
      }

      // Parse dispatch date using the helper function
      const dispatchDate = parseDate(row, 'DISPATCHDATE', 'DISPATCH_DATE', 'dispatchdate', 'dispatch_date', 'DispatchDate');

      validRows.push({
        wsn,
        dispatch_date: dispatchDate,
        customer_name: getValue(row, 'CUSTOMERNAME', 'CUSTOMER_NAME', 'customername', 'customer_name', 'CustomerName'),
        vehicle_no: getValue(row, 'VEHICLENO', 'VEHICLE_NO', 'vehicleno', 'vehicle_no', 'VehicleNo'),
        dispatch_remarks: getValue(row, 'DISPATCHREMARKS', 'DISPATCH_REMARKS', 'dispatchremarks', 'dispatch_remarks', 'DispatchRemarks'),
        other_remarks: getValue(row, 'OTHERREMARKS', 'OTHER_REMARKS', 'otherremarks', 'other_remarks', 'OtherRemarks'),
        source: sourceInfo.source
      });
    }

    console.log(`✅ Validated ${validRows.length} rows, ${errors.length} errors`);

    if (validRows.length === 0) {
      return res.json({
        batchId,
        totalRows: data.length,
        successCount: 0,
        errorCount: errors.length,
        errors: errors.slice(0, 50),
        timestamp: new Date().toISOString()
      });
    }

    // BATCH INSERT using PostgreSQL unnest for maximum performance
    const BATCH_SIZE = 1000; // Insert 1000 rows at a time
    let successCount = 0;

    console.log(`🚀 Starting batch insert of ${validRows.length} rows...`);

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);

      // Build arrays for unnest
      const dispatchDates: string[] = [];
      const customerNames: string[] = [];
      const wsnList: string[] = [];
      const vehicleNos: string[] = [];
      const dispatchRemarks: string[] = [];
      const otherRemarks: string[] = [];
      const quantities: number[] = [];
      const sources: string[] = [];
      const warehouseIds: number[] = [];
      const warehouseNames: string[] = [];
      const batchIds: string[] = [];
      const userNames: string[] = [];

      for (const row of batch) {
        dispatchDates.push(row.dispatch_date);
        customerNames.push(row.customer_name);
        wsnList.push(row.wsn);
        vehicleNos.push(row.vehicle_no);
        dispatchRemarks.push(row.dispatch_remarks);
        otherRemarks.push(row.other_remarks);
        quantities.push(1);
        sources.push(row.source);
        warehouseIds.push(warehouseId);
        warehouseNames.push(warehouseName);
        batchIds.push(batchId);
        userNames.push(userName);
      }

      // Use unnest for bulk insert
      const insertSql = `
        INSERT INTO outbound (
          dispatch_date, customer_name, wsn, vehicle_no, dispatch_remarks, other_remarks,
          quantity, source, warehouse_id, warehouse_name, batch_id, created_user_name
        )
        SELECT * FROM unnest(
          $1::date[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[],
          $7::int[], $8::text[], $9::int[], $10::text[], $11::text[], $12::text[]
        )
      `;

      try {
        await query(insertSql, [
          dispatchDates, customerNames, wsnList, vehicleNos, dispatchRemarks, otherRemarks,
          quantities, sources, warehouseIds, warehouseNames, batchIds, userNames
        ]);
        successCount += batch.length;
      } catch (batchError: any) {
        console.error(`❌ Batch insert error at rows ${i}-${i + batch.length}:`, batchError.message);
        // Fall back to individual inserts for this batch
        for (const row of batch) {
          try {
            await query(`
              INSERT INTO outbound (
                dispatch_date, customer_name, wsn, vehicle_no, dispatch_remarks, other_remarks,
                quantity, source, warehouse_id, warehouse_name, batch_id, created_user_name
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, [
              row.dispatch_date, row.customer_name, row.wsn, row.vehicle_no,
              row.dispatch_remarks, row.other_remarks, 1, row.source,
              warehouseId, warehouseName, batchId, userName
            ]);
            successCount++;
          } catch (rowError: any) {
            errors.push({ wsn: row.wsn, error: rowError.message });
          }
        }
      }

      // Log progress for large uploads
      if (validRows.length > 5000 && (i + BATCH_SIZE) % 10000 === 0) {
        console.log(`📊 Progress: ${Math.min(i + BATCH_SIZE, validRows.length)}/${validRows.length} rows inserted`);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`✅ Bulk upload completed: ${successCount}/${data.length} rows in ${totalTime}ms`);

    res.json({
      batchId,
      totalRows: data.length,
      successCount,
      errorCount: errors.length,
      errors: errors.slice(0, 50),
      duration: `${totalTime}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Bulk upload error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====== GET OUTBOUND LIST - OPTIMIZED for 1M+ rows ======
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
      batchId = '',
      brand = '',
      category = ''
    } = req.query;

    // Validate warehouse access - get accessible warehouses from middleware
    const accessibleWarehouses = (req as any).accessibleWarehouses as number[] | null;

    // If user has warehouse restrictions, validate the requested warehouse
    if (accessibleWarehouses && accessibleWarehouses.length > 0 && warehouseId) {
      const requestedId = parseInt(warehouseId as string);
      if (!accessibleWarehouses.includes(requestedId)) {
        return res.status(403).json({ error: 'Access denied to this warehouse' });
      }
    }

    const offset = (Number(page) - 1) * Number(limit);

    // Determine if we need master_data join
    const needsMasterJoin = Boolean(
      (search && search !== '') ||
      (brand && brand !== '') ||
      (category && category !== '')
    );

    let whereConditions: string[] = [];
    let countWhereConditions: string[] = [];
    const params: any[] = [];
    const countParams: any[] = [];
    let paramIndex = 1;
    let countParamIndex = 1;

    // Warehouse filter - apply restriction or requested ID
    if (accessibleWarehouses && accessibleWarehouses.length > 0) {
      if (warehouseId) {
        whereConditions.push(`o.warehouse_id = $${paramIndex}`);
        countWhereConditions.push(`o.warehouse_id = $${countParamIndex}`);
        params.push(warehouseId);
        countParams.push(warehouseId);
        paramIndex++;
        countParamIndex++;
      } else {
        // No specific warehouse requested, filter to user's accessible warehouses
        whereConditions.push(`o.warehouse_id = ANY($${paramIndex}::int[])`);
        countWhereConditions.push(`o.warehouse_id = ANY($${countParamIndex}::int[])`);
        params.push(accessibleWarehouses);
        countParams.push(accessibleWarehouses);
        paramIndex++;
        countParamIndex++;
      }
    } else if (warehouseId) {
      // No restrictions (super_admin/admin), but specific warehouse requested
      whereConditions.push(`o.warehouse_id = $${paramIndex}`);
      countWhereConditions.push(`o.warehouse_id = $${countParamIndex}`);
      params.push(warehouseId);
      countParams.push(warehouseId);
      paramIndex++;
      countParamIndex++;
    }

    if (search) {
      whereConditions.push(`(
        o.wsn ILIKE $${paramIndex} OR
        o.customer_name ILIKE $${paramIndex} OR
        o.vehicle_no ILIKE $${paramIndex} OR
        m.product_title ILIKE $${paramIndex} OR
        m.brand ILIKE $${paramIndex}
      )`);
      countWhereConditions.push(`(
        o.wsn ILIKE $${countParamIndex} OR
        o.customer_name ILIKE $${countParamIndex} OR
        o.vehicle_no ILIKE $${countParamIndex} OR
        m.product_title ILIKE $${countParamIndex} OR
        m.brand ILIKE $${countParamIndex}
      )`);
      params.push(`%${search}%`);
      countParams.push(`%${search}%`);
      paramIndex++;
      countParamIndex++;
    }

    if (source) {
      whereConditions.push(`o.source = $${paramIndex}`);
      countWhereConditions.push(`o.source = $${countParamIndex}`);
      params.push(source);
      countParams.push(source);
      paramIndex++;
      countParamIndex++;
    }

    if (customer) {
      whereConditions.push(`o.customer_name ILIKE $${paramIndex}`);
      countWhereConditions.push(`o.customer_name ILIKE $${countParamIndex}`);
      params.push(`%${customer}%`);
      countParams.push(`%${customer}%`);
      paramIndex++;
      countParamIndex++;
    }

    if (startDate) {
      whereConditions.push(`o.dispatch_date >= $${paramIndex}`);
      countWhereConditions.push(`o.dispatch_date >= $${countParamIndex}`);
      params.push(startDate);
      countParams.push(startDate);
      paramIndex++;
      countParamIndex++;
    }

    if (endDate) {
      whereConditions.push(`o.dispatch_date <= $${paramIndex}`);
      countWhereConditions.push(`o.dispatch_date <= $${countParamIndex}`);
      params.push(endDate);
      countParams.push(endDate);
      paramIndex++;
      countParamIndex++;
    }

    if (batchId) {
      whereConditions.push(`o.batch_id = $${paramIndex}`);
      countWhereConditions.push(`o.batch_id = $${countParamIndex}`);
      params.push(batchId);
      countParams.push(batchId);
      paramIndex++;
      countParamIndex++;
    }

    if (brand) {
      whereConditions.push(`m.brand ILIKE $${paramIndex}`);
      countWhereConditions.push(`m.brand ILIKE $${countParamIndex}`);
      params.push(`%${brand}%`);
      countParams.push(`%${brand}%`);
      paramIndex++;
      countParamIndex++;
    }

    if (category) {
      whereConditions.push(`m.cms_vertical ILIKE $${paramIndex}`);
      countWhereConditions.push(`m.cms_vertical ILIKE $${countParamIndex}`);
      params.push(`%${category}%`);
      countParams.push(`%${category}%`);
      paramIndex++;
      countParamIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';
    const countWhereClause = countWhereConditions.length > 0
      ? `WHERE ${countWhereConditions.join(' AND ')}`
      : '';

    // OPTIMIZED: Run count and ID queries in PARALLEL
    const countSql = needsMasterJoin
      ? `SELECT COUNT(*) as total FROM outbound o LEFT JOIN master_data m ON o.wsn = m.wsn ${countWhereClause}`
      : `SELECT COUNT(*) as total FROM outbound o ${countWhereClause}`;

    const idsSql = `
      SELECT o.id
      FROM outbound o
      ${needsMasterJoin ? 'LEFT JOIN master_data m ON o.wsn = m.wsn' : ''}
      ${whereClause}
      ORDER BY o.id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(Number(limit), offset);

    // Run both queries in parallel
    const [countResult, idsResult] = await Promise.all([
      query(countSql, countParams),
      query(idsSql, params)
    ]);

    const total = parseInt(countResult.rows[0].total);
    const ids = idsResult.rows.map((r: any) => r.id);

    // If no results, return empty
    if (ids.length === 0) {
      return res.json({
        data: [],
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      });
    }

    // PHASE 2: Fetch full data for the IDs
    const dataSql = `
      SELECT 
        o.*,
        m.product_title, m.brand, m.cms_vertical, m.wid, m.fsn, m.order_id,
        m.fkqc_remark, m.fk_grade, m.hsn_sac, m.igst_rate, m.fsp, m.mrp,
        m.vrp, m.yield_value, m.invoice_date, m.fkt_link, m.wh_location,
        m.p_type, m.p_size
      FROM outbound o
      LEFT JOIN master_data m ON o.wsn = m.wsn
      WHERE o.id = ANY($1)
      ORDER BY o.id DESC
    `;
    const result = await query(dataSql, [ids]);

    res.json({
      data: result.rows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (error: any) {
    console.error('❌ Get outbound list error:', error);
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
    // Get accessible warehouses from middleware (user's allowed warehouses)
    const accessibleWarehouses = (req as any).accessibleWarehouses as number[] | null;

    // Note: outbound table doesn't have created_at column
    // batch_id format: OUT_BULK_YYYYMMDD_HHMMSS - extract date from batch_id for display
    // Use MAX(id) for ordering (most recent inserts have higher IDs)
    let sql = `
      SELECT
        batch_id,
        COUNT(*) as count,
        MAX(dispatch_date) as last_updated
      FROM outbound
      WHERE batch_id IS NOT NULL
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // Apply warehouse filter - prioritize middleware restriction, then query param
    if (accessibleWarehouses && accessibleWarehouses.length > 0) {
      if (warehouseId) {
        const requestedId = parseInt(warehouseId as string);
        if (!accessibleWarehouses.includes(requestedId)) {
          return res.status(403).json({ error: 'Access denied to this warehouse' });
        }
        sql += ` AND warehouse_id = $${paramIndex}`;
        params.push(requestedId);
        paramIndex++;
      } else {
        sql += ` AND warehouse_id = ANY($${paramIndex}::int[])`;
        params.push(accessibleWarehouses);
        paramIndex++;
      }
    } else if (warehouseId) {
      sql += ` AND warehouse_id = $${paramIndex}`;
      params.push(warehouseId);
      paramIndex++;
    }

    sql += ` GROUP BY batch_id ORDER BY MAX(id) DESC`;

    const result = await query(sql, params);

    // Parse batch_id to extract upload date for display
    // batch_id format: OUT_BULK_YYYYMMDD_HHMMSS or similar patterns
    const batchesWithParsedDate = result.rows.map((row: any) => {
      let uploadDate = row.last_updated; // fallback to dispatch_date

      // Try to extract date from batch_id (e.g., OUT_BULK_20260121_134717)
      const match = row.batch_id?.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
      if (match) {
        const [, year, month, day, hour, min, sec] = match;
        uploadDate = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`).toISOString();
      }

      return {
        ...row,
        last_updated: uploadDate
      };
    });

    res.json(batchesWithParsedDate);
  } catch (error: any) {
    console.error('❌ Get batches error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ====== DELETE BATCH ======
export const deleteBatch = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const accessibleWarehouses = (req as any).accessibleWarehouses as number[] | null;

    // First check if the batch belongs to accessible warehouses
    if (accessibleWarehouses && accessibleWarehouses.length > 0) {
      const checkResult = await query(
        'SELECT DISTINCT warehouse_id FROM outbound WHERE batch_id = $1',
        [batchId]
      );

      if (checkResult.rows.length > 0) {
        const batchWarehouseIds = checkResult.rows.map((r: any) => r.warehouse_id);
        const hasAccess = batchWarehouseIds.every((wId: number) => accessibleWarehouses.includes(wId));
        if (!hasAccess) {
          return res.status(403).json({ error: 'Access denied: batch contains items from warehouses you cannot access' });
        }
      }
    }

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

// ============================================
// GET SOURCES - from outbound table
// ============================================
export const getSources = async (req: Request, res: Response) => {
  try {
    const { warehouse_id } = req.query;

    let sql = `
      SELECT DISTINCT o.source
      FROM outbound o
      WHERE o.source IS NOT NULL AND o.source != ''
    `;

    const params: any[] = [];

    if (warehouse_id) {
      sql += ` AND o.warehouse_id = $1`;
      params.push(warehouse_id);
    }

    sql += ` ORDER BY o.source`;

    const result = await query(sql, params);
    res.json(result.rows.map((r: any) => r.source));
  } catch (error: any) {
    console.error('❌ Get sources error:', error);
    res.status(500).json({ error: error.message });
  }
};
