import { Request, Response } from 'express';
import { query } from '../config/database';
import { generateBatchId } from '../utils/helpers';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import fs from 'fs';

// ✅ GET ALL QC'D WSNs (for duplicate checking)
export const getAllQCWSNs = async (req: Request, res: Response) => {
  try {
    // ✅ Use correct column name (check your database schema)
    const result = await query(
      `SELECT DISTINCT UPPER(TRIM(wsn)) as wsn, warehouse_id as warehouseid 
       FROM qc 
       WHERE wsn IS NOT NULL AND wsn != '' 
       ORDER BY wsn`
    );

    console.log('✅ QC WSNs fetched:', result.rows.length); // Debug log
    res.json(result.rows);
  } catch (error: any) {
    console.error('❌ Error fetching all QC WSNs:', error);
    res.status(500).json({ error: 'Failed to fetch QC WSNs' });
  }
};


// ✅ GET PENDING INBOUND ITEMS
export const getPendingInboundForQC = async (req: Request, res: Response) => {
  try {
    const { warehouseId, search } = req.query;
    let sql = `
      SELECT 
        i.id as inbound_id, 
        i.wsn, 
        i.inbound_date, 
        i.vehicle_no,
        i.rack_no, 
        i.product_serial_number, 
        
        -- ✅ MASTER DATA - ALL COLUMNS NEEDED FOR QC MULTI ENTRY
        m.product_title, 
        m.brand,
        m.cms_vertical, 
        m.mrp, 
        m.fsp, 
        m.fkt_link, 
        m.wid, 
        m.fsn,
        m.order_id,
        m.hsn_sac,          
        m.igst_rate,        
        m.invoice_date,
        m.p_type,
        m.p_size,
        m.vrp,
        m.yield_value,
        m.fkqc_remark,
        m.fk_grade,
        m.fkqc_remark,
        m.wh_location
      FROM inbound i
      LEFT JOIN master_data m ON i.wsn = m.wsn
      WHERE NOT EXISTS (SELECT 1 FROM qc WHERE qc.wsn = i.wsn)
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (warehouseId) {
      sql += ` AND i.warehouse_id = $${paramIndex}`;
      params.push(warehouseId);
      paramIndex++;
    }

    if (search) {
      sql += ` AND i.wsn = $${paramIndex}`;
      params.push(search);
      paramIndex++;
    }

    sql += ` ORDER BY i.created_at DESC LIMIT 1000`;
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('❌ Pending inbound error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ✅ GET QC LIST - OPTIMIZED for 1M+ rows
export const getQCList = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      warehouseId,
      qcStatus,
      qcGrade,
      dateFrom,
      dateTo,
      brand,
      category,
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

    // Determine if we need master_data join for filtering
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
        whereConditions.push(`q.warehouse_id = $${paramIndex}`);
        countWhereConditions.push(`q.warehouse_id = $${countParamIndex}`);
        params.push(warehouseId);
        countParams.push(warehouseId);
        paramIndex++;
        countParamIndex++;
      } else {
        // No specific warehouse requested, filter to user's accessible warehouses
        whereConditions.push(`q.warehouse_id = ANY($${paramIndex}::int[])`);
        countWhereConditions.push(`q.warehouse_id = ANY($${countParamIndex}::int[])`);
        params.push(accessibleWarehouses);
        countParams.push(accessibleWarehouses);
        paramIndex++;
        countParamIndex++;
      }
    } else if (warehouseId) {
      // No restrictions (super_admin/admin), but specific warehouse requested
      whereConditions.push(`q.warehouse_id = $${paramIndex}`);
      countWhereConditions.push(`q.warehouse_id = $${countParamIndex}`);
      params.push(warehouseId);
      countParams.push(warehouseId);
      paramIndex++;
      countParamIndex++;
    }

    if (search && search !== '') {
      whereConditions.push(`(
        q.wsn ILIKE $${paramIndex} OR
        m.product_title ILIKE $${paramIndex} OR
        m.brand ILIKE $${paramIndex}
      )`);
      countWhereConditions.push(`(
        q.wsn ILIKE $${countParamIndex} OR
        m.product_title ILIKE $${countParamIndex} OR
        m.brand ILIKE $${countParamIndex}
      )`);
      params.push(`%${search}%`);
      countParams.push(`%${search}%`);
      paramIndex++;
      countParamIndex++;
    }

    if (qcStatus && qcStatus !== '') {
      whereConditions.push(`q.qc_status = $${paramIndex}`);
      countWhereConditions.push(`q.qc_status = $${countParamIndex}`);
      params.push(qcStatus);
      countParams.push(qcStatus);
      paramIndex++;
      countParamIndex++;
    }

    if (qcGrade && qcGrade !== '') {
      whereConditions.push(`q.qc_grade = $${paramIndex}`);
      countWhereConditions.push(`q.qc_grade = $${countParamIndex}`);
      params.push(qcGrade);
      countParams.push(qcGrade);
      paramIndex++;
      countParamIndex++;
    }

    if (dateFrom) {
      whereConditions.push(`q.qc_date >= $${paramIndex}`);
      countWhereConditions.push(`q.qc_date >= $${countParamIndex}`);
      params.push(dateFrom);
      countParams.push(dateFrom);
      paramIndex++;
      countParamIndex++;
    }

    if (dateTo) {
      whereConditions.push(`q.qc_date <= $${paramIndex}`);
      countWhereConditions.push(`q.qc_date <= $${countParamIndex}`);
      params.push(dateTo);
      countParams.push(dateTo);
      paramIndex++;
      countParamIndex++;
    }

    if (brand && brand !== '') {
      whereConditions.push(`m.brand = $${paramIndex}`);
      countWhereConditions.push(`m.brand = $${countParamIndex}`);
      params.push(brand);
      countParams.push(brand);
      paramIndex++;
      countParamIndex++;
    }

    if (category && category !== '') {
      whereConditions.push(`m.cms_vertical = $${paramIndex}`);
      countWhereConditions.push(`m.cms_vertical = $${countParamIndex}`);
      params.push(category);
      countParams.push(category);
      paramIndex++;
      countParamIndex++;
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    const countWhereClause = countWhereConditions.length > 0 ? 'WHERE ' + countWhereConditions.join(' AND ') : '';

    // OPTIMIZED: Run count and ID queries in PARALLEL
    const countSql = needsMasterJoin
      ? `SELECT COUNT(*) FROM qc q LEFT JOIN master_data m ON q.wsn = m.wsn ${countWhereClause}`
      : `SELECT COUNT(*) FROM qc q ${countWhereClause}`;

    const idsSql = `
      SELECT q.id
      FROM qc q
      ${needsMasterJoin ? 'LEFT JOIN master_data m ON q.wsn = m.wsn' : ''}
      ${whereClause}
      ORDER BY q.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(Number(limit), offset);

    // Run both queries in parallel
    const [countResult, idsResult] = await Promise.all([
      query(countSql, countParams),
      query(idsSql, params)
    ]);

    const total = parseInt(countResult.rows[0]?.count || '0');
    const ids = idsResult.rows.map((r: any) => r.id);

    // If no results, return empty
    if (ids.length === 0) {
      return res.json({
        data: [],
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      });
    }

    // PHASE 2: Fetch full data for the IDs
    const dataSql = `
      SELECT
        q.id, q.wsn, q.qc_date, q.qc_by, q.qc_by_name, q.qc_grade, q.qc_status,
        q.qc_remarks, q.other_remarks, q.product_serial_number, q.rack_no,
        q.batch_id, q.created_at, q.updated_at, q.updated_by_name,
        i.inbound_date, i.vehicle_no, i.rack_no AS inbound_rack_no,
        m.wid, m.fsn, m.order_id, m.fkqc_remark, m.fk_grade, m.product_title,
        m.hsn_sac, m.igst_rate, m.fsp, m.mrp, m.invoice_date, m.fkt_link,
        m.wh_location, m.brand, m.cms_vertical, m.vrp, m.yield_value,
        m.p_type, m.p_size, m.upload_date, m.batch_id AS master_batch_id,
        m.created_user_name
      FROM qc q
      LEFT JOIN inbound i ON q.wsn = i.wsn AND q.warehouse_id = i.warehouse_id
      LEFT JOIN master_data m ON q.wsn = m.wsn
      WHERE q.id = ANY($1)
      ORDER BY q.created_at DESC
    `;
    const result = await query(dataSql, [ids]);

    res.json({
      data: result.rows,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error: any) {
    console.error('❌ Get QC list error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ✅ CREATE QC ENTRY
export const createQCEntry = async (req: Request, res: Response) => {
  try {
    const {
      wsn,
      qc_date,
      qc_grade,
      qc_remarks,
      other_remarks,
      product_serial_number,
      rack_no,
      warehouse_id,
      update_existing,
      qc_by_name,  // ← ADD THIS LINE
    } = req.body;

    const userId = (req as any).user?.userId;
    let currentUserName = (req as any).user?.full_name;

    // If full_name not in JWT, fetch from database
    if (!currentUserName) {
      try {
        const userResult = await query('SELECT full_name FROM users WHERE id = $1', [userId]);
        currentUserName = userResult.rows[0]?.full_name || 'Unknown';
      } catch (err) {
        console.error('Error fetching user name:', err);
        currentUserName = 'Unknown';
      }
    }
    // ✅ Prefer frontend-provided `qc_by_name` when it's a non-empty string, else use logged-in user
    const reqQcBy = typeof qc_by_name === 'string' ? qc_by_name.trim() : '';
    const qcByName = reqQcBy !== '' ? reqQcBy : currentUserName;


    // Check if QC already exists
    const checkSql = `SELECT id, warehouse_id FROM qc WHERE wsn = $1`;
    const checkResult = await query(checkSql, [wsn]);

    if (checkResult.rows.length > 0) {
      const existing = checkResult.rows[0];
      if (existing.warehouse_id === warehouse_id) {
        // Same warehouse, allow update if update_existing
        if (!update_existing) {
          return res.status(409).json({ error: 'QC already exists for this WSN in this warehouse', canUpdate: true });
        }
      } else {
        // Different warehouse, no update
        return res.status(409).json({ error: 'WSN already exists in another warehouse', canUpdate: false });
      }

      // Update existing
      const updateSql = `
        UPDATE qc
        SET qc_date = $1,
            qc_grade = $2,
            qc_remarks = $3,
            other_remarks = $4,
            product_serial_number = $5,
            rack_no = $6,
            qc_by = $7,
            qc_by_name = $8,
            updated_by = $9,
            updated_by_name = $10,
            updated_at = NOW()
        WHERE id = $11
        RETURNING *
      `;

      const updateResult = await query(updateSql, [
        qc_date,
        qc_grade,
        qc_remarks,
        other_remarks,
        product_serial_number,
        rack_no,
        userId,
        qcByName,
        userId,
        currentUserName,
        checkResult.rows[0].id,
      ]);

      return res.json({ ...updateResult.rows[0], action: 'updated' });
    }

    // Get inbound data
    const inboundSql = `SELECT id, warehouse_id FROM inbound WHERE wsn = $1 LIMIT 1`;
    const inboundResult = await query(inboundSql, [wsn]);

    if (inboundResult.rows.length === 0) {
      return res.status(404).json({ error: 'WSN not found in inbound' });
    }

    // Insert QC entry
    const insertSql = `
   INSERT INTO qc (
    wsn,
    inbound_id,
    qc_date,
    qc_by,
    qc_by_name,
    qc_grade,
    qc_remarks,
    other_remarks,
    product_serial_number,
    rack_no,
    updated_by,
    updated_by_name,
    warehouse_id,
    qc_status
   ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Done')
   RETURNING *
   `;


    const result = await query(insertSql, [
      wsn,
      inboundResult.rows[0].id,
      qc_date,
      userId,
      qcByName,
      qc_grade || null,
      qc_remarks || null,
      other_remarks || null,
      product_serial_number || null,
      rack_no || null,
      userId,
      currentUserName,
      warehouse_id,
    ]);

    res.status(201).json({ ...result.rows[0], action: 'created' });
  } catch (error: any) {
    console.error('❌ Create QC error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ✅ BULK UPLOAD
export const bulkQCUpload = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { warehouse_id } = req.body;
    const userId = (req as any).user?.userId;
    let userName = (req as any).user?.full_name;

    // If full_name not in JWT, fetch from database
    if (!userName) {
      try {
        const userResult = await query('SELECT full_name FROM users WHERE id = $1', [userId]);
        userName = userResult.rows[0]?.full_name || 'Unknown';
      } catch (err) {
        console.error('Error fetching user name:', err);
        userName = 'Unknown';
      }
    }
    const filePath = req.file.path;

    // Use shared parser utility for safer parsing
    const buffer = await fs.promises.readFile(filePath);
    const { parseExcelBuffer } = require('../utils/excelParser');
    const data: any[] = await parseExcelBuffer(Buffer.from(buffer));

    if (data.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Excel file is empty' });
    }

    const batchId = generateBatchId('QC_BULK');

    res.status(202).json({
      message: 'Upload started',
      batchId,
      totalRows: data.length,
      timestamp: new Date().toISOString(),
    });

    // Process in background
    processBulkQC(data, batchId, warehouse_id, userId, userName, filePath);
  } catch (error: any) {
    console.error('❌ Bulk upload error:', error);
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) { }
    }
    res.status(500).json({ error: error.message });
  }
};

async function processBulkQC(
  data: any[],
  batchId: string,
  warehouseId: string,
  userId: number,
  userName: string,
  filePath: string
) {
  const CHUNK_SIZE = 500;
  let successCount = 0;

  try {
    // Collect WSNs and check existing
    const wsns = data.map((row: any) => String(row['WSN'] || row['wsn'] || '').trim()).filter(Boolean);
    const existingMap = new Map();

    if (wsns.length > 0) {
      const existingSql = `SELECT wsn FROM qc WHERE wsn = ANY($1)`;
      const existingResult = await query(existingSql, [wsns]);
      existingResult.rows.forEach((row: any) => {
        existingMap.set(row.wsn, true);
      });
    }

    const validRows: any[] = [];

    for (const row of data) {
      const wsn = String(row['WSN'] || row['wsn'] || '').trim();

      if (!wsn || existingMap.has(wsn)) continue;

      const inboundCheck = await query(`SELECT id FROM inbound WHERE wsn = $1`, [wsn]);
      if (inboundCheck.rows.length === 0) continue;

      validRows.push({
        wsn,
        qc_date: row['QC_DATE'] || new Date().toISOString().split('T')[0],
        qc_grade: row['GRADE'] || null,
        qc_remarks: row['QC_REMARKS'] || null,
        other_remarks: row['OTHER_REMARKS'] || null,
        product_serial_number: row['PRODUCT_SERIAL_NUMBER'] || null,
        rack_no: row['RACK_NO'] || null,
        inbound_id: inboundCheck.rows[0].id,
      });
    }

    // Insert in chunks
    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE);
      const valuesClauses: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      for (const row of chunk) {
        // ✅ USE EXCEL QC_BY_NAME if provided (trim non-empty), otherwise logged-in userName
        const excelRaw = row.qc_by_name || row['QC_BY_NAME'] || '';
        const excelQcByName = (typeof excelRaw === 'string' && excelRaw.trim() !== '') ? excelRaw.trim() : userName;

        const rowParams = [
          row.wsn,
          row.inbound_id,
          row.qc_date,
          userId,
          excelQcByName,  // qc_by_name
          row.qc_grade,
          row.qc_remarks,
          row.other_remarks,
          row.product_serial_number,
          row.rack_no,
          userId,
          userName,  // updated_by_name (current user)
          warehouseId,
          batchId,
          'Done',
        ];



        const placeholders = rowParams.map(() => `$${paramIndex++}`).join(', ');
        valuesClauses.push(`(${placeholders})`);
        params.push(...rowParams);
      }

      const insertSql = `
  INSERT INTO qc (
    wsn, inbound_id, qc_date, qc_by, qc_by_name, qc_grade,
    qc_remarks, other_remarks, product_serial_number, rack_no,
    updated_by, updated_by_name, warehouse_id, batch_id, qc_status
  ) VALUES ${valuesClauses.join(', ')}
  `;
      const result = await query(insertSql, params);
      successCount += result.rowCount || 0;
    }

    console.log(`✅ Batch ${batchId}: ${successCount} records inserted`);
  } catch (error: any) {
    console.error('❌ Process bulk error:', error);
  } finally {
    try {
      fs.unlinkSync(filePath);
    } catch (e) { }
  }
}

// ✅ MULTI ENTRY
export const multiQCEntry = async (req: Request, res: Response) => {
  try {
    const { entries, warehouse_id } = req.body;
    const userId = (req as any).user?.userId;
    let userDefaultName = (req as any).user?.full_name;

    // If full_name not in JWT, fetch from database
    if (!userDefaultName) {
      try {
        const userResult = await query('SELECT full_name FROM users WHERE id = $1', [userId]);
        userDefaultName = userResult.rows[0]?.full_name || 'Unknown';
      } catch (err) {
        console.error('Error fetching user name:', err);
        userDefaultName = 'Unknown';
      }
    }

    // ✅ USE ENTRY'S QC_BY_NAME if provided (trim non-empty), otherwise user default
    const getQCByName = (entry: any) => {
      const raw = entry.qc_by_name || entry.qcByName || '';
      return (typeof raw === 'string' && raw.trim() !== '') ? raw.trim() : userDefaultName;
    };


    if (!entries || entries.length === 0) {
      return res.status(400).json({ error: 'No entries provided' });
    }

    const batchId = generateBatchId('QC_MULTI');
    let successCount = 0;
    const results: any[] = [];

    for (const entry of entries) {
      const wsn = entry.wsn?.trim();

      if (!wsn) {
        results.push({ wsn: 'EMPTY', status: 'ERROR', message: 'WSN required' });
        continue;
      }

      const qcCheck = await query(`SELECT id FROM qc WHERE wsn = $1 AND warehouse_id = $2`, [wsn, warehouse_id]);
      if (qcCheck.rows.length > 0) {
        results.push({ wsn, status: 'DUPLICATE', message: 'QC already exists in this warehouse' });
        continue;
      }

      const inboundCheck = await query(`SELECT id FROM inbound WHERE wsn = $1 AND warehouse_id = $2`, [wsn, warehouse_id]);
      if (inboundCheck.rows.length === 0) {
        results.push({ wsn, status: 'ERROR', message: 'WSN not found in inbound for this warehouse' });
        continue;
      }

      try {
        // FIX: Ensure qc_date is string
        const qcDate = typeof entry.qc_date === 'string'
          ? entry.qc_date
          : new Date().toISOString().split('T')[0];

        const entryQcByName = getQCByName(entry);  // ← USE ENTRY'S NAME

        const params = [
          wsn,
          inboundCheck.rows[0].id,
          qcDate,
          userId,
          entryQcByName,  // qc_by_name
          entry.qc_grade || null,
          entry.qc_remarks || null,
          entry.other_remarks || null,
          entry.product_serial_number || null,
          entry.rack_no || null,
          userId,
          userDefaultName,  // updated_by_name (current user)
          warehouse_id,
          batchId,
        ];


        await query(
          `INSERT INTO qc (wsn, inbound_id, qc_date, qc_by, qc_by_name, qc_grade,
           qc_remarks, other_remarks, product_serial_number, rack_no,
           updated_by, updated_by_name, warehouse_id, batch_id, qc_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'Done')`,
          params
        );

        results.push({ wsn, status: 'SUCCESS', message: 'Created' });
        successCount++;
      } catch (err: any) {
        results.push({ wsn, status: 'ERROR', message: err.message });
      }
    }

    res.json({
      batchId,
      totalCount: entries.length,
      successCount,
      results,
    });
  } catch (error: any) {
    console.error('❌ Multi entry error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ✅ GET STATS
export const getQCStats = async (req: Request, res: Response) => {
  try {
    const { warehouseId, dateFrom, dateTo } = req.query;

    let sql = `
      SELECT
        qc_status,
        COUNT(*) as count
      FROM qc
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (warehouseId) {
      sql += ` AND warehouse_id = $${paramIndex}`;
      params.push(warehouseId);
      paramIndex++;
    }

    if (dateFrom) {
      sql += ` AND DATE(qc_date) >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      sql += ` AND DATE(qc_date) <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    sql += ` GROUP BY qc_status`;

    const result = await query(sql, params);

    const stats = {
      pending: 0,
      pass: 0,
      fail: 0,
      hold: 0,
      done: 0,
      total: 0,
    };

    result.rows.forEach((row: any) => {
      const status = (row.qc_status || 'pending')?.toLowerCase();
      if (status === 'pass') stats.pass += parseInt(row.count);
      else if (status === 'fail') stats.fail += parseInt(row.count);
      else if (status === 'hold') stats.hold += parseInt(row.count);
      else if (status === 'done') stats.done += parseInt(row.count);
      else stats.pending += parseInt(row.count);

      stats.total += parseInt(row.count);
    });

    res.json(stats);
  } catch (error: any) {
    console.error('❌ QC stats error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ✅ GET BATCHES
export const getQCBatches = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.query;
    // Get accessible warehouses from middleware (user's allowed warehouses)
    const accessibleWarehouses = (req as any).accessibleWarehouses as number[] | null;

    let sql = `
      SELECT
        batch_id,
        COUNT(*) as count,
        MAX(created_at) as created_at,
        MIN(qc_status) as status
      FROM qc
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
    // If no accessibleWarehouses and no warehouseId, show all (super_admin/admin)

    sql += ` GROUP BY batch_id ORDER BY created_at DESC`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error('❌ Get batches error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ✅ DELETE BATCH
export const deleteQCBatch = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const accessibleWarehouses = (req as any).accessibleWarehouses as number[] | null;

    // First check if the batch belongs to accessible warehouses
    if (accessibleWarehouses && accessibleWarehouses.length > 0) {
      const checkResult = await query(
        'SELECT DISTINCT warehouse_id FROM qc WHERE batch_id = $1',
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

    const result = await query('DELETE FROM qc WHERE batch_id = $1', [batchId]);

    res.json({
      message: 'Batch deleted',
      count: result.rowCount,
    });
  } catch (error: any) {
    console.error('❌ Delete batch error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ✅ GET BRANDS
export const getQCBrands = async (req: Request, res: Response) => {
  try {
    const { warehouse_id } = req.query;

    let sql = `
      SELECT DISTINCT m.brand
      FROM qc q
      LEFT JOIN master_data m ON q.wsn = m.wsn
      WHERE m.brand IS NOT NULL AND m.brand != ''
    `;

    const params: any[] = [];

    if (warehouse_id) {
      sql += ` AND q.warehouse_id = $1`;
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

// ✅ GET CATEGORIES
export const getQCCategories = async (req: Request, res: Response) => {
  try {
    const { warehouse_id } = req.query;

    let sql = `
      SELECT DISTINCT m.cms_vertical
      FROM qc q
      LEFT JOIN master_data m ON q.wsn = m.wsn
      WHERE m.cms_vertical IS NOT NULL AND m.cms_vertical != ''
    `;

    const params: any[] = [];

    if (warehouse_id) {
      sql += ` AND q.warehouse_id = $1`;
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

// ✅ EXPORT DATA
export const exportQCData = async (req: Request, res: Response) => {
  try {
    const { warehouseId, dateFrom, dateTo, qcStatus, brand, category, qcGrade } = req.query;

    let sql = `
      SELECT
  -- QC
  q.*,

  -- INBOUND
  i.inbound_date,
  i.vehicle_no,

  -- MASTER DATA (FULL)
  m.wid,
  m.fsn,
  m.order_id,
  m.fkqc_remark,
  m.fk_grade,
  m.product_title,
  m.hsn_sac,
  m.igst_rate,
  m.fsp,
  m.mrp,
  m.invoice_date,
  m.fkt_link,
  m.wh_location,
  m.brand,
  m.cms_vertical,
  m.vrp,
  m.yield_value,
  m.p_type,
  m.p_size,
  m.upload_date,
  m.batch_id AS master_batch_id,
  m.created_user_name
FROM qc q
LEFT JOIN inbound i ON q.wsn = i.wsn
LEFT JOIN master_data m ON q.wsn = m.wsn
WHERE 1=1

    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (warehouseId) {
      sql += ` AND q.warehouse_id = $${paramIndex}`;
      params.push(warehouseId);
      paramIndex++;
    }

    if (dateFrom) {
      sql += ` AND DATE(q.qc_date) >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      sql += ` AND DATE(q.qc_date) <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    if (qcStatus) {
      sql += ` AND q.qc_status = $${paramIndex}`;
      params.push(qcStatus);
      paramIndex++;
    }

    if (qcGrade && qcGrade !== '') {
      sql += ` AND q.qc_grade = $${paramIndex}`;
      params.push(qcGrade);
      paramIndex++;
    }

    if (brand) {
      sql += ` AND m.brand = $${paramIndex}`;
      params.push(brand);
      paramIndex++;
    }

    if (category) {
      sql += ` AND m.cms_vertical = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    sql += ` ORDER BY q.qc_date DESC LIMIT 10000`;

    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (error: any) {
    console.error('❌ Export error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ✅ DELETE ENTRY
export const deleteQCEntry = async (req: Request, res: Response) => {
  try {
    const { qcId } = req.params;
    const result = await query('DELETE FROM qc WHERE id = $1', [qcId]);

    res.json({ message: 'QC entry deleted', count: result.rowCount });
  } catch (error: any) {
    console.error('❌ Delete error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ✅ GET TEMPLATE
export const getQCTemplate = async (req: Request, res: Response) => {
  try {
    const template = [{
      'WSN': 'ABC123_A',
      'QC_DATE': new Date().toISOString().split('T')[0],
      'GRADE': 'A',
      'QC_REMARKS': 'All checks passed',
      'OTHER_REMARKS': 'Package condition good',
      'PRODUCT_SERIAL_NUMBER': 'SN12345',
      'RACK_NO': 'A-01',
    }];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="QC_Template.xlsx"');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    res.send(buffer);
  } catch (error: any) {
    console.error('❌ Template error:', error);
    res.status(500).json({ error: error.message });
  }
};