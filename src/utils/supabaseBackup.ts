// File Path = warehouse-backend/src/utils/supabaseBackup.ts
/**
 * Supabase-friendly backup utilities
 * This provides JSON-based backups that work without pg_dump
 */

import { query } from '../config/database';
import fs from 'fs';
import path from 'path';

const BACKUP_DIR = path.join(__dirname, '../../backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

interface BackupOptions {
    tables?: string[];
    warehouseId?: number;
    includeUsers?: boolean;
}

/**
 * Create a JSON backup of the database
 * This works on any PostgreSQL database including Supabase
 * Uses chunked queries for large tables to prevent timeouts
 */
export async function createJSONBackup(options: BackupOptions = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `wms_backup_json_${timestamp}.json`;
    const backupFilePath = path.join(BACKUP_DIR, backupFileName);

    const defaultTables = [
        'warehouses',
        'customers',
        'racks',
        'master_data',
        'inbound',
        'qc',
        'picking',
        'outbound'

    ];

    if (options.includeUsers) {
        defaultTables.push('users');
    }

    const tablesToBackup = options.tables || defaultTables;

    const backupData: any = {
        metadata: {
            backup_date: new Date().toISOString(),
            database: 'wms',
            version: '1.0',
            tables: tablesToBackup,
            warehouse_id: options.warehouseId || 'all'
        },
        data: {}
    };

    console.log('📦 Creating JSON backup...');

    const CHUNK_SIZE = 10000; // Fetch data in chunks of 10k rows

    for (const tableName of tablesToBackup) {
        try {
            // First, get total count
            let countSql = `SELECT COUNT(*) FROM ${tableName}`;
            const countParams: any[] = [];

            if (options.warehouseId &&
                ['inbound', 'qc', 'picking', 'outbound', 'racks'].includes(tableName)) {
                countSql += ` WHERE warehouse_id = $1`;
                countParams.push(options.warehouseId);
            }

            const countResult = await query(countSql, countParams.length > 0 ? countParams : undefined);
            const totalRows = parseInt(countResult.rows[0].count);

            // If table is small enough, fetch all at once
            if (totalRows <= CHUNK_SIZE) {
                let sql = `SELECT * FROM ${tableName}`;
                const params: any[] = [];

                if (options.warehouseId &&
                    ['inbound', 'qc', 'picking', 'outbound', 'racks'].includes(tableName)) {
                    sql += ` WHERE warehouse_id = $1`;
                    params.push(options.warehouseId);
                }

                // Only add ORDER BY if table likely has created_at column
                if (!['outbound', 'picking'].includes(tableName)) {
                    sql += ` ORDER BY created_at DESC`;
                }

                const result = await query(sql, params.length > 0 ? params : undefined);
                backupData.data[tableName] = result.rows;
            } else {
                // Large table - fetch in chunks
                console.log(`  📊 Large table ${tableName}: fetching ${totalRows} rows in chunks...`);

                const allRows: any[] = [];
                let offset = 0;

                while (offset < totalRows) {
                    let sql = `SELECT * FROM ${tableName}`;
                    const params: any[] = [];

                    if (options.warehouseId &&
                        ['inbound', 'qc', 'picking', 'outbound', 'racks'].includes(tableName)) {
                        sql += ` WHERE warehouse_id = $1`;
                        params.push(options.warehouseId);
                    }

                    // Add ordering by primary key for consistent pagination
                    sql += ` ORDER BY id LIMIT ${CHUNK_SIZE} OFFSET ${offset}`;

                    const result = await query(sql, params.length > 0 ? params : undefined);
                    allRows.push(...result.rows);

                    offset += CHUNK_SIZE;
                    console.log(`    Progress: ${Math.min(offset, totalRows)}/${totalRows} rows`);
                }

                backupData.data[tableName] = allRows;
            }

            console.log(`  ✓ Backed up ${tableName}: ${backupData.data[tableName].length} rows`);
        } catch (error: any) {
            console.warn(`  ⚠️ Could not backup table ${tableName}:`, error.message);
            backupData.data[tableName] = {
                error: error.message,
                rows: []
            };
        }
    }

    // Write to file
    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));

    const stats = fs.statSync(backupFilePath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`✅ JSON backup created: ${backupFileName} (${fileSizeInMB} MB)`);

    return {
        fileName: backupFileName,
        filePath: backupFilePath,
        fileSize: stats.size,
        fileSizeMB: fileSizeInMB,
        tableCount: tablesToBackup.length
    };
}

/**
 * Create a CSV export of specific table
 */
export async function exportTableAsCSV(tableName: string, warehouseId?: number) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const csvFileName = `${tableName}_export_${timestamp}.csv`;
    const csvFilePath = path.join(BACKUP_DIR, csvFileName);

    let sql = `SELECT * FROM ${tableName}`;
    const params: any[] = [];

    if (warehouseId &&
        ['inbound', 'qc', 'picking', 'outbound', 'racks'].includes(tableName)) {
        sql += ` WHERE warehouse_id = $1`;
        params.push(warehouseId);
    }

    const result = await query(sql, params.length > 0 ? params : undefined);

    if (result.rows.length === 0) {
        throw new Error('No data to export');
    }

    // Generate CSV content
    const headers = Object.keys(result.rows[0]);
    const csvContent = [
        headers.join(','),
        ...result.rows.map(row =>
            headers.map(header => {
                const value = row[header];
                // Escape commas and quotes in values
                if (value === null || value === undefined) return '';
                const stringValue = String(value);
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            }).join(',')
        )
    ].join('\n');

    fs.writeFileSync(csvFilePath, csvContent);

    const stats = fs.statSync(csvFilePath);

    console.log(`✅ CSV export created: ${csvFileName} (${result.rows.length} rows)`);

    return {
        fileName: csvFileName,
        filePath: csvFilePath,
        fileSize: stats.size,
        rowCount: result.rows.length
    };
}

/**
 * Schedule automatic backups (call this from a cron job or scheduler)
 */
export async function scheduleBackup(frequency: 'daily' | 'weekly' = 'daily') {
    try {
        console.log(`🕐 Running scheduled ${frequency} backup...`);

        const backup = await createJSONBackup({
            includeUsers: false // Don't backup passwords in scheduled backups
        });

        // Save backup metadata to database
        await query(
            `INSERT INTO backups (
        file_name, 
        file_path, 
        file_size, 
        backup_type, 
        description
      ) VALUES ($1, $2, $3, $4, $5)`,
            [
                backup.fileName,
                backup.filePath,
                backup.fileSize,
                'scheduled_json',
                `Automated ${frequency} backup`
            ]
        );

        // Clean up old backups (keep last 30 days)
        const retentionDays = 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const oldBackups = await query(
            `SELECT id, file_path FROM backups 
       WHERE created_at < $1 AND backup_type = 'scheduled_json'`,
            [cutoffDate]
        );

        for (const oldBackup of oldBackups.rows) {
            try {
                if (fs.existsSync(oldBackup.file_path)) {
                    fs.unlinkSync(oldBackup.file_path);
                }
                await query('DELETE FROM backups WHERE id = $1', [oldBackup.id]);
                console.log(`  🗑️ Cleaned up old backup: ${oldBackup.id}`);
            } catch (err) {
                console.warn(`  ⚠️ Failed to clean up backup ${oldBackup.id}`);
            }
        }

        console.log(`✅ Scheduled backup completed successfully`);
        return backup;

    } catch (error: any) {
        console.error('❌ Scheduled backup failed:', error);
        throw error;
    }
}

/**
 * Get database size and statistics
 */
export async function getDatabaseStatistics() {
    try {
        // Get total database size
        const dbSizeResult = await query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as total_size,
             pg_database_size(current_database()) as total_size_bytes
    `);

        // Get table sizes
        const tableSizesResult = await query(`
      SELECT 
        schemaname as schema,
        tablename as table_name,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = tablename) as row_count_estimate
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY size_bytes DESC
    `);

        // Get row counts for main tables
        const tables = ['warehouses', 'users', 'master_data', 'inbound', 'qc', 'picking', 'outbound', 'racks'];
        const rowCounts: any = {};

        for (const table of tables) {
            try {
                const countResult = await query(`SELECT COUNT(*) as count FROM ${table}`);
                rowCounts[table] = parseInt(countResult.rows[0].count);
            } catch (err) {
                rowCounts[table] = 0;
            }
        }

        return {
            total_size: dbSizeResult.rows[0].total_size,
            total_size_bytes: dbSizeResult.rows[0].total_size_bytes,
            tables: tableSizesResult.rows,
            row_counts: rowCounts
        };

    } catch (error) {
        console.error('Failed to get database statistics:', error);
        throw error;
    }
}
