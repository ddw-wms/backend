// File Path = warehouse-backend/src/controllers/reports.controller.ts
import { Request, Response } from 'express';
import { query } from '../config/database';
import * as XLSX from 'xlsx';

// =================== INVENTORY REPORTS ===================

// Current Stock Report
export const getCurrentStockReport = async (req: Request, res: Response) => {
    try {
        const { warehouse_id, brand, category } = req.query;

        let whereConditions: string[] = ['1=1'];
        const params: any[] = [];
        let paramIndex = 1;

        if (warehouse_id) {
            whereConditions.push(`i.warehouse_id = $${paramIndex}`);
            params.push(warehouse_id);
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

        const whereClause = whereConditions.join(' AND ');

        const sql = `
      SELECT 
        i.wsn,
        i.warehouse_id,
        w.name as warehouse_name,
        m.product_title,
        m.brand,
        m.cms_vertical,
        m.mrp,
        m.fsp,
        i.inbound_date,
        i.rack_no,
        CASE 
          WHEN EXISTS (SELECT 1 FROM outbound o WHERE o.wsn = i.wsn AND o.warehouse_id = i.warehouse_id) THEN 'OUTBOUND'
          WHEN EXISTS (SELECT 1 FROM picking p WHERE p.wsn = i.wsn AND p.warehouse_id = i.warehouse_id) THEN 'PICKING'
          WHEN EXISTS (SELECT 1 FROM qc q WHERE q.wsn = i.wsn AND q.warehouse_id = i.warehouse_id) THEN 'QC'
          ELSE 'INBOUND'
        END as current_status
      FROM inbound i
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      LEFT JOIN master_data m ON i.wsn = m.wsn
      WHERE ${whereClause}
      ORDER BY i.inbound_date DESC
    `;

        const result = await query(sql, params);
        res.json({ data: result.rows, total: result.rows.length });
    } catch (error: any) {
        console.error('❌ Current stock report error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Stock Movement Report
export const getStockMovementReport = async (req: Request, res: Response) => {
    try {
        const { warehouse_id, wsn, start_date, end_date } = req.query;

        let whereConditions: string[] = ['1=1'];
        const params: any[] = [];
        let paramIndex = 1;

        if (warehouse_id) {
            whereConditions.push(`warehouse_id = $${paramIndex}`);
            params.push(warehouse_id);
            paramIndex++;
        }

        if (wsn) {
            whereConditions.push(`wsn ILIKE $${paramIndex}`);
            params.push(`%${wsn}%`);
            paramIndex++;
        }

        const whereClause = whereConditions.join(' AND ');

        let dateFilterInbound = '';
        let dateFilterQC = '';
        let dateFilterPicking = '';
        let dateFilterOutbound = '';

        if (start_date && end_date) {
            dateFilterInbound = `AND inbound_date BETWEEN $${paramIndex}::date AND $${paramIndex + 1}::date`;
            dateFilterQC = `AND qc_date BETWEEN $${paramIndex}::date AND $${paramIndex + 1}::date`;
            dateFilterPicking = `AND picking_date BETWEEN $${paramIndex}::date AND $${paramIndex + 1}::date`;
            dateFilterOutbound = `AND dispatch_date BETWEEN $${paramIndex}::date AND $${paramIndex + 1}::date`;
            params.push(start_date, end_date);
        }

        const sql = `
      SELECT * FROM (
        SELECT wsn, warehouse_id, 'INBOUND' as movement_type, inbound_date as movement_date, inbound_date as sort_date, created_user_name as user_name
        FROM inbound WHERE ${whereClause} ${dateFilterInbound}
        UNION ALL
        SELECT wsn, warehouse_id, 'QC' as movement_type, qc_date as movement_date, qc_date as sort_date, qc_by_name as user_name
        FROM qc WHERE ${whereClause} ${dateFilterQC}
        UNION ALL
        SELECT wsn, warehouse_id, 'PICKING' as movement_type, picking_date as movement_date, picking_date as sort_date, picker_name as user_name
        FROM picking WHERE ${whereClause} ${dateFilterPicking}
        UNION ALL
        SELECT wsn, warehouse_id, 'OUTBOUND' as movement_type, dispatch_date as movement_date, dispatch_date as sort_date, created_user_name as user_name
        FROM outbound WHERE ${whereClause} ${dateFilterOutbound}
      ) movements
      ORDER BY sort_date DESC
    `;

        const result = await query(sql, params);
        res.json({ data: result.rows, total: result.rows.length });
    } catch (error: any) {
        console.error('❌ Stock movement report error:', error);
        res.status(500).json({ error: error.message });
    }
};

// =================== INBOUND REPORTS ===================

export const getInboundReport = async (req: Request, res: Response) => {
    try {
        const { warehouse_id, start_date, end_date, brand, category } = req.query;

        let whereConditions: string[] = ['1=1'];
        const params: any[] = [];
        let paramIndex = 1;

        if (warehouse_id) {
            whereConditions.push(`i.warehouse_id = $${paramIndex}`);
            params.push(warehouse_id);
            paramIndex++;
        }

        if (start_date) {
            whereConditions.push(`i.inbound_date >= $${paramIndex}`);
            params.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            whereConditions.push(`i.inbound_date <= $${paramIndex}`);
            params.push(end_date);
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

        const whereClause = whereConditions.join(' AND ');

        const sql = `
      SELECT 
        i.*,
        w.name as warehouse_name,
        m.product_title,
        m.brand,
        m.cms_vertical,
        m.mrp,
        m.fsp
      FROM inbound i
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      LEFT JOIN master_data m ON i.wsn = m.wsn
      WHERE ${whereClause}
      ORDER BY i.inbound_date DESC
    `;

        const result = await query(sql, params);

        // Summary stats
        const statsSql = `
      SELECT 
        COUNT(*) as total_inbound,
        COUNT(DISTINCT i.wsn) as unique_items,
        COUNT(DISTINCT m.brand) as brands_count,
        COUNT(DISTINCT m.cms_vertical) as categories_count
      FROM inbound i
      LEFT JOIN master_data m ON i.wsn = m.wsn
      WHERE ${whereClause}
    `;

        const statsResult = await query(statsSql, params);

        res.json({
            data: result.rows,
            summary: statsResult.rows[0],
            total: result.rows.length
        });
    } catch (error: any) {
        console.error('❌ Inbound report error:', error);
        res.status(500).json({ error: error.message });
    }
};

// =================== OUTBOUND REPORTS ===================

export const getOutboundReport = async (req: Request, res: Response) => {
    try {
        const { warehouse_id, start_date, end_date, customer, source } = req.query;

        let whereConditions: string[] = ['1=1'];
        const params: any[] = [];
        let paramIndex = 1;

        if (warehouse_id) {
            whereConditions.push(`o.warehouse_id = $${paramIndex}`);
            params.push(warehouse_id);
            paramIndex++;
        }

        if (start_date) {
            whereConditions.push(`o.dispatch_date >= $${paramIndex}`);
            params.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            whereConditions.push(`o.dispatch_date <= $${paramIndex}`);
            params.push(end_date);
            paramIndex++;
        }

        if (customer) {
            whereConditions.push(`o.customer_name ILIKE $${paramIndex}`);
            params.push(`%${customer}%`);
            paramIndex++;
        }

        if (source) {
            whereConditions.push(`o.source = $${paramIndex}`);
            params.push(source);
            paramIndex++;
        }

        const whereClause = whereConditions.join(' AND ');

        const sql = `
      SELECT 
        o.*,
        w.name as warehouse_name,
        m.product_title,
        m.brand,
        m.cms_vertical,
        m.mrp,
        m.fsp
      FROM outbound o
      LEFT JOIN warehouses w ON o.warehouse_id = w.id
      LEFT JOIN master_data m ON o.wsn = m.wsn
      WHERE ${whereClause}
      ORDER BY o.dispatch_date DESC
    `;

        const result = await query(sql, params);

        res.json({ data: result.rows, total: result.rows.length });
    } catch (error: any) {
        console.error('❌ Outbound report error:', error);
        res.status(500).json({ error: error.message });
    }
};

// =================== QC REPORTS ===================

export const getQCReport = async (req: Request, res: Response) => {
    try {
        const { warehouse_id, start_date, end_date, qc_grade, qc_status } = req.query;

        let whereConditions: string[] = ['1=1'];
        const params: any[] = [];
        let paramIndex = 1;

        if (warehouse_id) {
            whereConditions.push(`q.warehouse_id = $${paramIndex}`);
            params.push(warehouse_id);
            paramIndex++;
        }

        if (start_date) {
            whereConditions.push(`q.qc_date >= $${paramIndex}`);
            params.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            whereConditions.push(`q.qc_date <= $${paramIndex}`);
            params.push(end_date);
            paramIndex++;
        }

        if (qc_grade) {
            whereConditions.push(`q.qc_grade = $${paramIndex}`);
            params.push(qc_grade);
            paramIndex++;
        }

        if (qc_status) {
            whereConditions.push(`q.qc_status = $${paramIndex}`);
            params.push(qc_status);
            paramIndex++;
        }

        const whereClause = whereConditions.join(' AND ');

        const sql = `
      SELECT 
        q.*,
        w.name as warehouse_name,
        m.product_title,
        m.brand,
        m.cms_vertical
      FROM qc q
      LEFT JOIN warehouses w ON q.warehouse_id = w.id
      LEFT JOIN master_data m ON q.wsn = m.wsn
      WHERE ${whereClause}
      ORDER BY q.qc_date DESC
    `;

        const result = await query(sql, params);

        // QC Summary
        const summarySql = `
      SELECT 
        qc_grade,
        qc_status,
        COUNT(*) as count
      FROM qc q
      WHERE ${whereClause}
      GROUP BY qc_grade, qc_status
    `;

        const summaryResult = await query(summarySql, params);

        res.json({
            data: result.rows,
            summary: summaryResult.rows,
            total: result.rows.length
        });
    } catch (error: any) {
        console.error('❌ QC report error:', error);
        res.status(500).json({ error: error.message });
    }
};

// =================== PICKING REPORTS ===================

export const getPickingReport = async (req: Request, res: Response) => {
    try {
        const { warehouse_id, start_date, end_date, customer } = req.query;

        let whereConditions: string[] = ['1=1'];
        const params: any[] = [];
        let paramIndex = 1;

        if (warehouse_id) {
            whereConditions.push(`p.warehouse_id = $${paramIndex}`);
            params.push(warehouse_id);
            paramIndex++;
        }

        if (start_date) {
            whereConditions.push(`p.picking_date >= $${paramIndex}`);
            params.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            whereConditions.push(`p.picking_date <= $${paramIndex}`);
            params.push(end_date);
            paramIndex++;
        }

        if (customer) {
            whereConditions.push(`p.customer_name ILIKE $${paramIndex}`);
            params.push(`%${customer}%`);
            paramIndex++;
        }

        const whereClause = whereConditions.join(' AND ');

        const sql = `
      SELECT 
        p.*,
        w.name as warehouse_name,
        m.product_title,
        m.brand
      FROM picking p
      LEFT JOIN warehouses w ON p.warehouse_id = w.id
      LEFT JOIN master_data m ON p.wsn = m.wsn
      WHERE ${whereClause}
      ORDER BY p.picking_date DESC
    `;

        const result = await query(sql, params);
        res.json({ data: result.rows, total: result.rows.length });
    } catch (error: any) {
        console.error('❌ Picking report error:', error);
        res.status(500).json({ error: error.message });
    }
};

// =================== PERFORMANCE REPORTS ===================

export const getUserPerformanceReport = async (req: Request, res: Response) => {
    try {
        const { warehouse_id, start_date, end_date } = req.query;

        let dateFilterInbound = '';
        let dateFilterQC = '';
        let dateFilterPicking = '';
        let dateFilterOutbound = '';
        const warehouseFilter = warehouse_id ? `AND warehouse_id = ${warehouse_id}` : '';

        if (start_date && end_date) {
            dateFilterInbound = `AND inbound_date BETWEEN '${start_date}'::date AND '${end_date}'::date`;
            dateFilterQC = `AND qc_date BETWEEN '${start_date}'::date AND '${end_date}'::date`;
            dateFilterPicking = `AND picking_date BETWEEN '${start_date}'::date AND '${end_date}'::date`;
            dateFilterOutbound = `AND dispatch_date BETWEEN '${start_date}'::date AND '${end_date}'::date`;
        }

        const sql = `
      SELECT 
        user_name,
        activity_type,
        COUNT(*) as total_operations,
        MIN(operation_date) as first_operation,
        MAX(operation_date) as last_operation
      FROM (
        SELECT created_user_name as user_name, 'INBOUND' as activity_type, inbound_date as operation_date, warehouse_id FROM inbound WHERE created_user_name IS NOT NULL ${dateFilterInbound} ${warehouseFilter}
        UNION ALL
        SELECT qc_by_name as user_name, 'QC' as activity_type, qc_date as operation_date, warehouse_id FROM qc WHERE qc_by_name IS NOT NULL ${dateFilterQC} ${warehouseFilter}
        UNION ALL
        SELECT picker_name as user_name, 'PICKING' as activity_type, picking_date as operation_date, warehouse_id FROM picking WHERE picker_name IS NOT NULL ${dateFilterPicking} ${warehouseFilter}
        UNION ALL
        SELECT created_user_name as user_name, 'OUTBOUND' as activity_type, dispatch_date as operation_date, warehouse_id FROM outbound WHERE created_user_name IS NOT NULL ${dateFilterOutbound} ${warehouseFilter}
      ) user_activities
      GROUP BY user_name, activity_type
      ORDER BY user_name, activity_type
    `;

        const result = await query(sql);
        res.json({ data: result.rows, total: result.rows.length });
    } catch (error: any) {
        console.error('❌ User performance report error:', error);
        res.status(500).json({ error: error.message });
    }
};

// =================== SUMMARY DASHBOARD ===================

export const getWarehouseSummary = async (req: Request, res: Response) => {
    try {
        const { warehouse_id, start_date, end_date } = req.query;

        let whereConditions: string[] = ['1=1'];
        const params: any[] = [];
        let paramIndex = 1;

        if (warehouse_id) {
            whereConditions.push(`warehouse_id = $${paramIndex}`);
            params.push(warehouse_id);
            paramIndex++;
        }

        let dateFilterInbound = '';
        let dateFilterQC = '';
        let dateFilterPicking = '';
        let dateFilterOutbound = '';

        if (start_date && end_date) {
            dateFilterInbound = `AND inbound_date BETWEEN $${paramIndex}::date AND $${paramIndex + 1}::date`;
            dateFilterQC = `AND qc_date BETWEEN $${paramIndex}::date AND $${paramIndex + 1}::date`;
            dateFilterPicking = `AND picking_date BETWEEN $${paramIndex}::date AND $${paramIndex + 1}::date`;
            dateFilterOutbound = `AND dispatch_date BETWEEN $${paramIndex}::date AND $${paramIndex + 1}::date`;
            params.push(start_date, end_date);
        }

        const whereClause = whereConditions.join(' AND ');

        const inboundCountSql = `SELECT COUNT(*) as count FROM inbound WHERE ${whereClause} ${dateFilterInbound}`;
        const qcCountSql = `SELECT COUNT(*) as count FROM qc WHERE ${whereClause} ${dateFilterQC}`;
        const pickingCountSql = `SELECT COUNT(*) as count FROM picking WHERE ${whereClause} ${dateFilterPicking}`;
        const outboundCountSql = `SELECT COUNT(*) as count FROM outbound WHERE ${whereClause} ${dateFilterOutbound}`;

        const [inbound, qc, picking, outbound] = await Promise.all([
            query(inboundCountSql, params),
            query(qcCountSql, params),
            query(pickingCountSql, params),
            query(outboundCountSql, params)
        ]);

        res.json({
            inbound: parseInt(inbound.rows[0].count),
            qc: parseInt(qc.rows[0].count),
            picking: parseInt(picking.rows[0].count),
            outbound: parseInt(outbound.rows[0].count),
            total: parseInt(inbound.rows[0].count) + parseInt(qc.rows[0].count) +
                parseInt(picking.rows[0].count) + parseInt(outbound.rows[0].count)
        });
    } catch (error: any) {
        console.error('❌ Warehouse summary error:', error);
        res.status(500).json({ error: error.message });
    }
};

// =================== EXPORT TO EXCEL ===================

export const exportReportToExcel = async (req: Request, res: Response) => {
    try {
        const { report_type, ...filters } = req.query;

        let reportData: any[] = [];
        let fileName = 'report.xlsx';

        // Get report data based on type
        switch (report_type) {
            case 'current_stock':
                const stockSql = `
          SELECT i.wsn, w.name as warehouse, m.product_title, m.brand, m.cms_vertical, 
                 i.inbound_date, i.rack_no
          FROM inbound i
          LEFT JOIN warehouses w ON i.warehouse_id = w.id
          LEFT JOIN master_data m ON i.wsn = m.wsn
          ${filters.warehouse_id ? `WHERE i.warehouse_id = ${filters.warehouse_id}` : ''}
          ORDER BY i.inbound_date DESC
        `;
                const stockResult = await query(stockSql);
                reportData = stockResult.rows;
                fileName = 'current_stock_report.xlsx';
                break;

            case 'inbound':
                const inboundSql = `
          SELECT i.*, w.name as warehouse, m.product_title, m.brand, m.cms_vertical
          FROM inbound i
          LEFT JOIN warehouses w ON i.warehouse_id = w.id
          LEFT JOIN master_data m ON i.wsn = m.wsn
          WHERE 1=1
          ${filters.warehouse_id ? `AND i.warehouse_id = ${filters.warehouse_id}` : ''}
          ${filters.start_date ? `AND i.inbound_date >= '${filters.start_date}'` : ''}
          ${filters.end_date ? `AND i.inbound_date <= '${filters.end_date}'` : ''}
          ORDER BY i.inbound_date DESC
        `;
                const inboundResult = await query(inboundSql);
                reportData = inboundResult.rows;
                fileName = 'inbound_report.xlsx';
                break;

            case 'outbound':
                const outboundSql = `
          SELECT o.*, w.name as warehouse, m.product_title, m.brand
          FROM outbound o
          LEFT JOIN warehouses w ON o.warehouse_id = w.id
          LEFT JOIN master_data m ON o.wsn = m.wsn
          WHERE 1=1
          ${filters.warehouse_id ? `AND o.warehouse_id = ${filters.warehouse_id}` : ''}
          ${filters.start_date ? `AND o.dispatch_date >= '${filters.start_date}'` : ''}
          ${filters.end_date ? `AND o.dispatch_date <= '${filters.end_date}'` : ''}
          ORDER BY o.dispatch_date DESC
        `;
                const outboundResult = await query(outboundSql);
                reportData = outboundResult.rows;
                fileName = 'outbound_report.xlsx';
                break;

            default:
                return res.status(400).json({ error: 'Invalid report type' });
        }

        // Create Excel file
        const worksheet = XLSX.utils.json_to_sheet(reportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error: any) {
        console.error('❌ Export report error:', error);
        res.status(500).json({ error: error.message });
    }
};
