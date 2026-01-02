// File Path = warehouse-backend/src/controllers/master-data.controller.ts
import { Request, Response } from 'express';
import { query } from '../config/database';
import { generateBatchId } from '../utils/helpers';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { createReadStream } from 'fs';
import ExcelJS from 'exceljs';

const PROGRESS_DIR = path.join(__dirname, '../../temp/progress');

// ✅ REQUIRED COLUMNS - EXACT order and EXACT names (Issue #4 fix)
const REQUIRED_COLUMNS = [
  'WSN', 'WID', 'FSN', 'Order_ID', 'FKQC_Remark', 'FK_Grade', 'Product_Title',
  'HSN/SAC', 'IGST_Rate', 'FSP', 'MRP', 'Invoice_Date', 'Fkt_Link',
  'Wh_Location', 'BRAND', 'cms_vertical', 'VRP', 'Yield_Value', 'P_Type', 'P_Size'
];

if (!fs.existsSync(PROGRESS_DIR)) {
  fs.mkdirSync(PROGRESS_DIR, { recursive: true });
}

function saveProgress(jobId: string, data: any) {
  const filePath = path.join(PROGRESS_DIR, `${jobId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data));
}

function getProgress(jobId: string) {
  const filePath = path.join(PROGRESS_DIR, `${jobId}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return null;
}

function deleteProgress(jobId: string) {
  const filePath = path.join(PROGRESS_DIR, `${jobId}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// ✅ FIX #3: Helper to convert UTC to IST in database
const convertUTCtoIST = (utcDate: Date): Date => {
  const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
  return istDate;
};

export const getMasterData = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 100, search = '', batch_id = '', status = '', brand = '', category = '' } = req.query;
    const offset = ((Number(page) - 1) * Number(limit));
    let whereClause = '';
    const params: any[] = [];
    let paramIndex = 1;

    // Build WHERE clause for search and batch_id
    if (search && search !== '') {
      whereClause += `(wsn ILIKE $${paramIndex} OR fsn ILIKE $${paramIndex} OR brand ILIKE $${paramIndex} OR product_title ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (batch_id && batch_id !== '') {
      whereClause += whereClause ? ` AND batch_id = $${paramIndex}` : `batch_id = $${paramIndex}`;
      params.push(batch_id);
      paramIndex++;
    }

    if (brand && brand !== '') {
      whereClause += whereClause ? ` AND brand = $${paramIndex}` : `brand = $${paramIndex}`;
      params.push(brand);
      paramIndex++;
    }

    if (category && category !== '') {
      whereClause += whereClause ? ` AND cms_vertical = $${paramIndex}` : `cms_vertical = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    // Status filter - use subquery to filter on calculated column
    let statusWhereClause = '';
    if (status && status !== '' && status !== 'All') {
      if (status === 'Received') {
        statusWhereClause = ` AND EXISTS(SELECT 1 FROM inbound WHERE inbound.wsn = md.wsn)`;
      } else if (status === 'Pending') {
        statusWhereClause = ` AND NOT EXISTS(SELECT 1 FROM inbound WHERE inbound.wsn = md.wsn)`;
      }
    }

    // Add limit and offset at the end
    params.push(limit);
    params.push(offset);

    const finalWhereClause = whereClause ? `WHERE ${whereClause}` : 'WHERE 1=1';

    const result = await query(
      `SELECT md.*,
              CASE 
                WHEN EXISTS(SELECT 1 FROM inbound WHERE inbound.wsn = md.wsn) THEN 'Received'
                ELSE 'Pending'
              END as actual_received
       FROM master_data md
       ${finalWhereClause}
       ${statusWhereClause}
       ORDER BY md.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    // Get count with same filters
    let countWhereClause = '';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (search && search !== '') {
      countWhereClause += `(wsn ILIKE $${countParamIndex} OR fsn ILIKE $${countParamIndex} OR brand ILIKE $${countParamIndex} OR product_title ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    if (batch_id && batch_id !== '') {
      countWhereClause += countWhereClause ? ` AND batch_id = $${countParamIndex}` : `batch_id = $${countParamIndex}`;
      countParams.push(batch_id);
      countParamIndex++;
    }

    if (brand && brand !== '') {
      countWhereClause += countWhereClause ? ` AND brand = $${countParamIndex}` : `brand = $${countParamIndex}`;
      countParams.push(brand);
      countParamIndex++;
    }

    if (category && category !== '') {
      countWhereClause += countWhereClause ? ` AND cms_vertical = $${countParamIndex}` : `cms_vertical = $${countParamIndex}`;
      countParams.push(category);
      countParamIndex++;
    }

    let countStatusWhereClause = '';
    if (status && status !== '' && status !== 'All') {
      if (status === 'Received') {
        countStatusWhereClause = ` AND EXISTS(SELECT 1 FROM inbound WHERE inbound.wsn = md.wsn)`;
      } else if (status === 'Pending') {
        countStatusWhereClause = ` AND NOT EXISTS(SELECT 1 FROM inbound WHERE inbound.wsn = md.wsn)`;
      }
    }

    const countFinalWhereClause = countWhereClause ? `WHERE ${countWhereClause}` : 'WHERE 1=1';

    const countResult = await query(
      `SELECT COUNT(*) FROM master_data md
       ${countFinalWhereClause}
       ${countStatusWhereClause}`,
      countParams
    );

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: Number(page),
      limit: Number(limit),
    });

  } catch (error: any) {
    console.error('❌ Get master data error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Download Excel Template 
export const downloadTemplate = async (req: Request, res: Response) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Master Data');

    // Add header row with formatting
    worksheet.addRow(REQUIRED_COLUMNS);
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } };
    // ✅ FIX: Use 'middle' instead of 'center' for vertical alignment
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };

    // Set column widths for clean view
    REQUIRED_COLUMNS.forEach((_, idx) => {
      worksheet.getColumn(idx + 1).width = 18;
    });

    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Add sample row (light gray - just for reference)
    const sampleRow = worksheet.addRow([
      'WSN001', 'WID001', 'FSN001', 'ORD001', 'Remark', 'Grade-A', 'Product Name',
      '12345', '5', '100', '150', '2025-01-01', 'https://link.com',
      'Rack-A1', 'BrandName', 'Vertical', '120', '95', 'Type-A', 'Size-M'
    ]);
    sampleRow.font = { italic: true, color: { argb: 'FF808080' } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Master_Data_Template.xlsx');

    await workbook.xlsx.write(res);
    res.end();

  } catch (error: any) {
    console.error('❌ Template download error:', error);
    res.status(500).json({ error: error.message });
  }
};

//✅ Upload - Stream processing (NO memory issues)
// export const uploadMasterData = async (req: Request, res: Response) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ error: 'No file uploaded' });
//     }

//     const filePath = req.file.path;
//     const fileExt = path.extname(req.file.originalname).toLowerCase();
//     const fileSize = (req.file.size / 1024 / 1024).toFixed(2);

//     console.log(`📤 Upload: ${req.file.originalname} (${fileSize}MB)`);

//     const batchId = generateBatchId('BULK');
//     const jobId = `job_${Date.now()}`;
//     const uploadTimestampUTC = new Date().toISOString();  // ← FIX


//     // Immediate response
//     res.status(202).json({
//       message: 'Upload started',
//       jobId,
//       batchId,
//       fileSize
//     });

//     // Background processing
//     if (fileExt === '.csv') {
//       processCSVStream(filePath, batchId, jobId, uploadTimestampUTC);
//     } else if (fileExt === '.xlsx' || fileExt === '.xls') {
//       processExcelStream(filePath, batchId, jobId, uploadTimestampUTC);

//     } else {
//       // ✅ FIX: Reject invalid formats
//       saveProgress(jobId, {
//         status: 'failed',
//         error: `Invalid file format: ${fileExt}. Only .xlsx, .xls, .csv allowed`,
//         batchId
//       });
//       cleanup(filePath, jobId);
//     }

//   } catch (error: any) {
//     console.error('❌ Upload error:', error);
//     if (req.file?.path) {
//       try { fs.unlinkSync(req.file.path); } catch (e) { }
//     }
//     res.status(500).json({ error: error.message });
//   }
// };
// ✅ Also add validation in uploadMasterData
export const uploadMasterData = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const fileSize = (req.file.size / 1024 / 1024).toFixed(2);

    console.log(`📤 Upload: ${req.file.originalname} (${fileSize}MB)`);

    // ✅ Validate file extension FIRST
    if (fileExt !== '.csv' && fileExt !== '.xlsx' && fileExt !== '.xls') {
      // Clean up uploaded file
      try { fs.unlinkSync(filePath); } catch (e) { }

      return res.status(400).json({
        error: `Invalid file format: ${fileExt}. Only .xlsx, .xls, and .csv files are allowed.`
      });
    }

    // ✅ Validate file size (e.g., max 50MB)
    const maxSizeMB = 50;
    if (req.file.size > maxSizeMB * 1024 * 1024) {
      try { fs.unlinkSync(filePath); } catch (e) { }

      return res.status(400).json({
        error: `File size exceeds ${maxSizeMB}MB limit. Please upload a smaller file.`
      });
    }

    const batchId = generateBatchId('BULK');
    const jobId = `job_${Date.now()}`;
    const uploadTimestampUTC = new Date().toISOString();

    // Immediate response
    res.status(202).json({
      message: 'Upload started',
      jobId,
      batchId,
      fileSize
    });

    // Background processing
    if (fileExt === '.csv') {
      processCSVStream(filePath, batchId, jobId, uploadTimestampUTC);
    } else if (fileExt === '.xlsx' || fileExt === '.xls') {
      processExcelStream(filePath, batchId, jobId, uploadTimestampUTC);
    }

  } catch (error: any) {
    console.error('❌ Upload error:', error);
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch (e) { }
    }
    res.status(500).json({ error: error.message });
  }
};


//✅ CSV Stream Processing with proper validation 
async function processCSVStream(filePath: string, batchId: string, jobId: string, uploadTimestampUTC: string) {
  const CHUNK_SIZE = 2000;
  let rows: any[] = [];
  let total = 0;
  let success = 0;
  let headerValidated = false;
  let isFirstRow = true;

  try {
    saveProgress(jobId, {
      status: 'processing',
      processed: 0,
      total: 0,
      successCount: 0,
      batchId
    });

    const stream = createReadStream(filePath).pipe(csv());

    stream.on('data', async (row: any) => {
      // ✅ FIX: Skip header row in CSV properly
      if (isFirstRow) {
        isFirstRow = false;

        // Validate header on first row
        if (!headerValidated) {
          headerValidated = true;
          const headerRow = Object.keys(row);
          const normalizedHeader = headerRow.map(h => h.trim().toLowerCase());
          const normalizedRequired = REQUIRED_COLUMNS.map(c => c.trim().toLowerCase());

          const isValid = normalizedRequired.every(col =>
            normalizedHeader.includes(col)
          );

          if (!isValid) {
            console.warn('⚠️ CSV header mismatch!');
            console.warn('Expected:', REQUIRED_COLUMNS);
            console.warn('Got:', headerRow);
            // End stream - format invalid
            stream.destroy();
            saveProgress(jobId, {
              status: 'failed',
              error: 'CSV header format does not match required columns',
              batchId
            });
            cleanup(filePath, jobId);
            return;
          }
        }
        return; // Skip header row
      }

      const wsn = row['WSN'] || row['wsn'];
      if (!wsn || String(wsn).trim() === '') return;

      // ✅ FIX: Ensure all values are strings, not objects
      rows.push({
        wsn: String(wsn).trim(),
        wid: row['WID'] ? String(row['WID']).trim() : null,
        fsn: row['FSN'] ? String(row['FSN']).trim() : null,
        order_id: row['Order_ID'] ? String(row['Order_ID']).trim() : null,
        fkqc_remark: row['FKQC_Remark'] ? String(row['FKQC_Remark']).trim() : null,
        fk_grade: row['FK_Grade'] ? String(row['FK_Grade']).trim() : null,
        product_title: row['Product_Title'] ? String(row['Product_Title']).trim() : null,
        hsn_sac: row['HSN/SAC'] ? String(row['HSN/SAC']).trim() : null,
        igst_rate: row['IGST_Rate'] ? String(row['IGST_Rate']).trim() : null,
        fsp: row['FSP'] ? String(row['FSP']).trim() : null,
        mrp: row['MRP'] ? String(row['MRP']).trim() : null,
        invoice_date: row['Invoice_Date'] ? String(row['Invoice_Date']).trim() : null,
        fkt_link: row['Fkt_Link'] ? String(row['Fkt_Link']).trim() : null,
        wh_location: row['Wh_Location'] ? String(row['Wh_Location']).trim() : null,
        brand: row['BRAND'] ? String(row['BRAND']).trim() : null,
        cms_vertical: row['cms_vertical'] ? String(row['cms_vertical']).trim() : null,
        vrp: row['VRP'] ? String(row['VRP']).trim() : null,
        yield_value: row['Yield_Value'] ? String(row['Yield_Value']).trim() : null,
        p_type: row['P_Type'] ? String(row['P_Type']).trim() : null,
        p_size: row['P_Size'] ? String(row['P_Size']).trim() : null,
        batchId,
        uploadTimestampUTC
      });

      total++;

      if (rows.length >= CHUNK_SIZE) {
        stream.pause();
        try {
          await insertBatch(rows);
          success += rows.length;
          rows = [];
          saveProgress(jobId, {
            status: 'processing',
            processed: total,
            total: total,
            successCount: success,
            batchId
          });
          stream.resume();
        } catch (err) {
          console.error('❌ Batch insert error:', err);
          stream.resume();
        }
      }
    });

    stream.on('end', async () => {
      if (rows.length > 0) {
        try {
          await insertBatch(rows);
          success += rows.length;
        } catch (err) {
          console.error('❌ Final batch error:', err);
        }
      }

      saveProgress(jobId, {
        status: 'completed',
        processed: total,
        total: total,
        successCount: success,
        batchId
      });

      console.log(`✅ CSV complete: ${success}/${total} rows`);
      cleanup(filePath, jobId);
    });

    stream.on('error', (err) => {
      console.error('❌ Stream error:', err);
      saveProgress(jobId, { status: 'failed', error: err.message, batchId });
      cleanup(filePath, jobId);
    });

  } catch (error: any) {
    console.error('❌ CSV processing error:', error);
    saveProgress(jobId, { status: 'failed', error: error.message, batchId });
    cleanup(filePath, jobId);
  }
}

// ✅ Excel Stream Processing with validation 
// async function processExcelStream(filePath: string, batchId: string, jobId: string, uploadTimestampUTC: string) {
//   const CHUNK_SIZE = 1000;
//   let rows: any[] = [];
//   let total = 0;
//   let success = 0;
//   let isFirstRow = true;
//   let headerValidationDone = false;

//   try {
//     saveProgress(jobId, {
//       status: "processing",
//       processed: 0,
//       total: 0,
//       successCount: 0,
//       batchId,
//     });

//     const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
//       entries: "emit",
//       sharedStrings: "cache",
//       worksheets: "emit",
//       styles: "cache",
//     });

//     let shouldStop = false;

//     for await (const worksheetReader of workbookReader) {
//       if (shouldStop) break;

//       for await (const row of worksheetReader) {
//         if (shouldStop) break;

//         const values = row.values as ExcelJS.CellValue[];

//         // ✅ FIX: Skip header row and validate
//         if (isFirstRow) {
//           isFirstRow = false;

//           if (!headerValidationDone) {
//             headerValidationDone = true;

//             // Get header cells (indices 1-20, skipping index 0)
//             const headerCells = values.slice(1, 21).map(v => {
//               if (v === null || v === undefined) return '';
//               return String(v).trim().toLowerCase();
//             });

//             const normalizedRequired = REQUIRED_COLUMNS.map(c => c.trim().toLowerCase());

//             // Check if all required columns are present
//             const isValidHeader = normalizedRequired.every((col, idx) => {
//               return (headerCells[idx] || '') === col;
//             });

//             if (!isValidHeader) {
//               console.warn('⚠️ Excel header validation failed!');
//               console.warn('Expected:', normalizedRequired);
//               console.warn('Got:', headerCells);

//               // Stop processing
//               saveProgress(jobId, {
//                 status: 'failed',
//                 error: 'Excel header format does not match required columns. Expected exact order: ' + REQUIRED_COLUMNS.join(', '),
//                 batchId
//               });

//               shouldStop = true;
//               break;
//             }
//           }
//           continue; // Skip header row
//         }

//         const wsn = values[1];
//         if (!wsn || String(wsn).trim() === '') continue;

//         // ✅ FIX: Convert all cell values to strings to prevent [object Object]
//         rows.push({
//           wsn: String(wsn || '').trim(),
//           wid: values[2] ? String(values[2]).trim() : null,
//           fsn: values[3] ? String(values[3]).trim() : null,
//           order_id: values[4] ? String(values[4]).trim() : null,
//           fkqc_remark: values[5] ? String(values[5]).trim() : null,
//           fk_grade: values[6] ? String(values[6]).trim() : null,
//           product_title: values[7] ? String(values[7]).trim() : null,
//           hsn_sac: values[8] ? String(values[8]).trim() : null,
//           igst_rate: values[9] ? String(values[9]).trim() : null,
//           fsp: values[10] ? String(values[10]).trim() : null,
//           mrp: values[11] ? String(values[11]).trim() : null,
//           invoice_date: values[12] ? String(values[12]).trim() : null,
//           fkt_link: values[13] ? String(values[13]).trim() : null,
//           wh_location: values[14] ? String(values[14]).trim() : null,
//           brand: values[15] ? String(values[15]).trim() : null,
//           cms_vertical: values[16] ? String(values[16]).trim() : null,
//           vrp: values[17] ? String(values[17]).trim() : null,
//           yield_value: values[18] ? String(values[18]).trim() : null,
//           p_type: values[19] ? String(values[19]).trim() : null,
//           p_size: values[20] ? String(values[20]).trim() : null,
//           batchId,
//           uploadTimestampUTC
//         });

//         total++;

//         if (rows.length >= CHUNK_SIZE) {
//           try {
//             await insertBatch(rows);
//             success += rows.length;
//             rows = [];
//             saveProgress(jobId, {
//               status: "processing",
//               processed: total,
//               total,
//               successCount: success,
//               batchId,
//             });

//             await new Promise((r) => setTimeout(r, 50));
//           } catch (err) {
//             console.error("❌ Batch insert error:", err);
//           }
//         }
//       }
//     }

//     if (shouldStop) {
//       cleanup(filePath, jobId);
//       return;
//     }

//     if (rows.length > 0) {
//       await insertBatch(rows);
//       success += rows.length;
//     }

//     saveProgress(jobId, {
//       status: "completed",
//       processed: total,
//       total,
//       successCount: success,
//       batchId,
//     });

//     console.log(`✅ Excel complete: ${success}/${total} rows`);
//     cleanup(filePath, jobId);

//   } catch (error: any) {
//     console.error("❌ Excel stream error:", error);
//     saveProgress(jobId, { status: "failed", error: error.message, batchId });
//     cleanup(filePath, jobId);
//   }
// }
// Add this improved validation before processing Excel
async function processExcelStream(filePath: string, batchId: string, jobId: string, uploadTimestampUTC: string) {
  const CHUNK_SIZE = 1000;
  let rows: any[] = [];
  let total = 0;
  let success = 0;
  let isFirstRow = true;
  let headerValidationDone = false;
  let workbookReader: ExcelJS.stream.xlsx.WorkbookReader | null = null;

  try {
    saveProgress(jobId, {
      status: "processing",
      processed: 0,
      total: 0,
      successCount: 0,
      batchId,
    });

    // ✅ STEP 1: Validate file exists and is readable
    if (!fs.existsSync(filePath)) {
      throw new Error('Uploaded file not found');
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error('Uploaded file is empty');
    }

    // ✅ STEP 2: Validate file is a valid Excel file (check magic bytes)
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    // Excel files start with PK (ZIP format) - magic bytes: 50 4B
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
      throw new Error('Invalid Excel file format. File appears to be corrupted or not a valid .xlsx file');
    }

    // ✅ STEP 3: Try to initialize workbook reader with error handling
    try {
      workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
        entries: "emit",
        sharedStrings: "cache",
        worksheets: "emit",
        styles: "cache",
      });
    } catch (readerError: any) {
      throw new Error(`Failed to read Excel file: ${readerError.message || 'File may be corrupted'}`);
    }

    let shouldStop = false;
    let worksheetCount = 0;

    // ✅ STEP 4: Process worksheets with validation
    for await (const worksheetReader of workbookReader) {
      if (shouldStop) break;

      worksheetCount++;

      // Validate worksheet structure
      if (!worksheetReader || typeof worksheetReader !== 'object') {
        throw new Error('Invalid worksheet structure detected in Excel file');
      }

      for await (const row of worksheetReader) {
        if (shouldStop) break;

        // Validate row structure
        if (!row || !row.values || !Array.isArray(row.values)) {
          console.warn('⚠️ Skipping invalid row structure');
          continue;
        }

        const values = row.values as ExcelJS.CellValue[];

        // ✅ Header validation (first row only)
        if (isFirstRow) {
          isFirstRow = false;

          if (!headerValidationDone) {
            headerValidationDone = true;

            // Get header cells (indices 1-20, skipping index 0)
            const headerCells = values.slice(1, 21).map(v => {
              if (v === null || v === undefined) return '';
              return String(v).trim().toLowerCase();
            });

            const normalizedRequired = REQUIRED_COLUMNS.map(c => c.trim().toLowerCase());

            // Check if all required columns are present
            const isValidHeader = normalizedRequired.every((col, idx) => {
              return (headerCells[idx] || '') === col;
            });

            if (!isValidHeader) {
              console.warn('⚠️ Excel header validation failed!');
              console.warn('Expected:', normalizedRequired);
              console.warn('Got:', headerCells);

              // Create detailed error message
              const missingCols = normalizedRequired.filter((col, idx) =>
                (headerCells[idx] || '') !== col
              );

              const errorMsg = `Excel header format does not match template. 
                
Expected columns in exact order:
${REQUIRED_COLUMNS.join(', ')}

Please download the template file and ensure your Excel file matches the exact format.`;

              // Stop processing
              saveProgress(jobId, {
                status: 'failed',
                error: errorMsg,
                batchId
              });

              shouldStop = true;
              break;
            }
          }
          continue; // Skip header row
        }

        const wsn = values[1];
        if (!wsn || String(wsn).trim() === '') continue;

        // ✅ Convert all cell values to strings safely
        rows.push({
          wsn: String(wsn || '').trim(),
          wid: values[2] ? String(values[2]).trim() : null,
          fsn: values[3] ? String(values[3]).trim() : null,
          order_id: values[4] ? String(values[4]).trim() : null,
          fkqc_remark: values[5] ? String(values[5]).trim() : null,
          fk_grade: values[6] ? String(values[6]).trim() : null,
          product_title: values[7] ? String(values[7]).trim() : null,
          hsn_sac: values[8] ? String(values[8]).trim() : null,
          igst_rate: values[9] ? String(values[9]).trim() : null,
          fsp: values[10] ? String(values[10]).trim() : null,
          mrp: values[11] ? String(values[11]).trim() : null,
          invoice_date: values[12] ? String(values[12]).trim() : null,
          fkt_link: values[13] ? String(values[13]).trim() : null,
          wh_location: values[14] ? String(values[14]).trim() : null,
          brand: values[15] ? String(values[15]).trim() : null,
          cms_vertical: values[16] ? String(values[16]).trim() : null,
          vrp: values[17] ? String(values[17]).trim() : null,
          yield_value: values[18] ? String(values[18]).trim() : null,
          p_type: values[19] ? String(values[19]).trim() : null,
          p_size: values[20] ? String(values[20]).trim() : null,
          batchId,
          uploadTimestampUTC
        });

        total++;

        if (rows.length >= CHUNK_SIZE) {
          try {
            await insertBatch(rows);
            success += rows.length;
            rows = [];
            saveProgress(jobId, {
              status: "processing",
              processed: total,
              total,
              successCount: success,
              batchId,
            });

            await new Promise((r) => setTimeout(r, 50));
          } catch (err) {
            console.error("❌ Batch insert error:", err);
          }
        }
      }
    }

    // ✅ Validate that at least one worksheet was processed
    if (worksheetCount === 0) {
      throw new Error('Excel file contains no worksheets or is corrupted');
    }

    if (shouldStop) {
      cleanup(filePath, jobId);
      return;
    }

    // Process remaining rows
    if (rows.length > 0) {
      await insertBatch(rows);
      success += rows.length;
    }

    saveProgress(jobId, {
      status: "completed",
      processed: total,
      total,
      successCount: success,
      batchId,
    });

    console.log(`✅ Excel complete: ${success}/${total} rows`);
    cleanup(filePath, jobId);

  } catch (error: any) {
    console.error("❌ Excel stream error:", error);

    // Cleanup workbook reader if it exists
    if (workbookReader && typeof (workbookReader as any).destroy === 'function') {
      try {
        (workbookReader as any).destroy();
      } catch (e) {
        console.error('Error destroying workbook reader:', e);
      }
    }

    // Provide user-friendly error messages
    let errorMessage = error.message || 'Failed to process Excel file';

    // Specific error messages for common issues
    if (errorMessage.includes('sheets') || errorMessage.includes('undefined')) {
      errorMessage = 'Invalid or corrupted Excel file. Please ensure you are uploading a valid .xlsx file created from our template.';
    } else if (errorMessage.includes('magic bytes') || errorMessage.includes('PK')) {
      errorMessage = 'File is not a valid Excel format. Please upload only .xlsx files.';
    } else if (errorMessage.includes('header')) {
      // Keep the detailed header error message
      errorMessage = error.message;
    }

    saveProgress(jobId, {
      status: "failed",
      error: errorMessage,
      batchId
    });

    cleanup(filePath, jobId);
  }
}


// ✅ Batch Insert with proper data types and created_at timestamp
async function insertBatch(rows: any[]): Promise<void> {
  if (rows.length === 0) return;

  // ✅ FIX: Remove duplicates within the batch to avoid "ON CONFLICT DO UPDATE command cannot affect row a second time"
  // Keep only the last occurrence of each WSN (latest data wins)
  const uniqueRows = new Map<string, any>();
  for (const row of rows) {
    if (row.wsn) {
      uniqueRows.set(row.wsn, row);
    }
  }
  const deduplicatedRows = Array.from(uniqueRows.values());

  if (deduplicatedRows.length === 0) return;

  const valuesSqlParts: string[] = [];
  const params: any[] = [];
  let idx = 1;

  for (const row of deduplicatedRows) {
    // Convert the upload timestamp ISO -> epoch seconds (float)
    // fallback to current UTC epoch seconds if parsing fails
    let createdAtEpoch: number;
    try {
      const ms = Date.parse(row.uploadTimestampUTC);
      createdAtEpoch = isNaN(ms) ? Date.now() / 1000 : ms / 1000;
    } catch {
      createdAtEpoch = Date.now() / 1000;
    }

    // Build param list in the same order as columns - but for created_at we'll push the epoch number
    const paramList = [
      row.wsn,
      row.wid,
      row.fsn,
      row.order_id,
      row.fkqc_remark,
      row.fk_grade,
      row.product_title,
      row.hsn_sac,
      row.igst_rate,
      row.fsp,
      row.mrp,
      row.invoice_date,
      row.fkt_link,
      row.wh_location,
      row.brand,
      row.cms_vertical,
      row.vrp,
      row.yield_value,
      row.p_type,
      row.p_size,
      row.batchId,
      createdAtEpoch // <--- epoch seconds for to_timestamp()
    ];

    // Build the placeholders for this row. For the last param (created_at) use to_timestamp($N)
    const placeholdersForRow = paramList.map((_, i) => {
      const placeholderIndex = idx + i;
      // last item => created_at epoch -> use to_timestamp($n)
      if (i === paramList.length - 1) {
        return `to_timestamp($${placeholderIndex})`;
      }
      return `$${placeholderIndex}`;
    }).join(', ');

    valuesSqlParts.push(`(${placeholdersForRow})`);

    // push params values (note: createdAtEpoch is pushed as number)
    params.push(...paramList);

    // advance idx
    idx += paramList.length;
  }

  const sql = `INSERT INTO master_data (
    wsn, wid, fsn, order_id, fkqc_remark, fk_grade, product_title, hsn_sac,
    igst_rate, fsp, mrp, invoice_date, fkt_link, wh_location, brand, cms_vertical,
    vrp, yield_value, p_type, p_size, batch_id, created_at
  ) VALUES ${valuesSqlParts.join(', ')}
  ON CONFLICT (wsn) DO UPDATE
    SET created_at = EXCLUDED.created_at`; // still update created_at on conflict

  await query(sql, params);
}




function cleanup(filePath: string, jobId: string, csvPath?: string) {
  try { fs.unlinkSync(filePath); } catch (e) { }
  if (csvPath) try { fs.unlinkSync(csvPath); } catch (e) { }
  setTimeout(() => deleteProgress(jobId), 3600000);
}

export const getUploadProgress = async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const progress = getProgress(jobId);
  res.json(progress || { status: 'not_found' });
};

export const cancelUpload = async (req: Request, res: Response) => {
  const { jobId } = req.params;
  deleteProgress(jobId);
  res.json({ message: 'Cancelled' });
};

export const getActiveUploads = async (req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(PROGRESS_DIR);
    const jobs = files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const jobId = f.replace('.json', '');
        const prog = getProgress(jobId);
        return { jobId, ...prog };
      })
      .filter(j => j.status === 'processing');

    res.json(jobs);
  } catch (error) {
    res.json([]);
  }
};

export const deleteMasterData = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM master_data WHERE id = $1', [id]);
    res.json({ message: 'Deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteBatch = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    await query('DELETE FROM master_data WHERE batch_id = $1', [batchId]);
    res.json({ message: 'Deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getBatches = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT batch_id, COUNT(*) as count, MAX(created_at) as lastupdated
       FROM master_data GROUP BY batch_id ORDER BY lastupdated DESC`
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const exportMasterData = async (req: Request, res: Response) => {
  try {
    const { batchIds, dateFrom, dateTo } = req.query;
    let where: string[] = [];
    const params: any[] = [];

    let idx = 1;

    if (batchIds && typeof batchIds === 'string') {
      const batches = batchIds.split(',');
      where.push(`batch_id IN (${batches.map(() => `$${idx++}`).join(',')})`);
      params.push(...batches);
    }

    if (dateFrom && dateTo) {
      where.push(`created_at >= $${idx++}`);
      where.push(`created_at <= $${idx++}`);
      params.push(dateFrom);
      params.push(dateTo);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `SELECT * FROM master_data ${whereClause} LIMIT 100000`;

    const result = await query(sql, params);

    res.json({ data: result.rows, count: result.rows.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};