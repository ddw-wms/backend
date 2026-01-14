// File Path = warehouse-backend/src/controllers/backup.controller.ts
import { Request, Response } from 'express';
import { query, getPool } from '../config/database';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createJSONBackup, exportTableAsCSV, getDatabaseStatistics } from '../utils/supabaseBackup';
import { backupScheduler } from '../services/backupScheduler';
import { uploadToR2, deleteFromR2, isR2Configured } from '../services/cloudflareR2';

const execPromise = promisify(exec);

const BACKUP_DIR = path.join(__dirname, '../../backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Store backup/restore progress for async operations
const backupProgress = new Map<string, {
    status: string;
    progress: number;
    message: string;
    result?: any;
    details?: {
        currentTable?: string;
        tableProgress?: number;
        completedTables?: number;
        totalTables?: number;
        processedRows?: number;
        totalRows?: number;
    };
}>();

// ================= CREATE DATABASE BACKUP =================
export const createBackup = async (req: Request, res: Response) => {
    try {
        const { backup_type = 'full', description = '', use_json = true, async_mode = true } = req.body;
        const user = (req as any).user;

        // If JSON backup is requested (works on Supabase)
        if (use_json || backup_type === 'json') {
            console.log('🔄 Creating JSON backup (Supabase-friendly)...');

            // Generate a unique backup ID for tracking
            const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // For large data, use async mode to prevent timeout
            if (async_mode) {
                // Initialize progress tracking
                backupProgress.set(backupId, {
                    status: 'in_progress',
                    progress: 0,
                    message: 'Starting backup...'
                });

                // Send immediate response with backup ID
                res.json({
                    success: true,
                    message: 'Backup started in background',
                    backupId,
                    status: 'in_progress'
                });

                // Process backup in background
                processBackupAsync(backupId, backup_type, description, user?.id);
                return;
            }

            // Sync mode (for small data)
            const backupResult = await createJSONBackup({
                includeUsers: backup_type === 'full'
            });

            // Upload to Cloudflare R2 (if configured)
            if (isR2Configured()) {
                await uploadToR2(backupResult.filePath, backupResult.fileName);
            }

            // Save backup metadata to database
            const result = await query(
                `INSERT INTO backups (
          file_name, 
          file_path, 
          file_size, 
          backup_type, 
          description, 
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING *`,
                [
                    backupResult.fileName,
                    backupResult.filePath,
                    backupResult.fileSize,
                    'json',
                    description || 'JSON backup',
                    user?.id || null
                ]
            );

            return res.json({
                success: true,
                message: 'JSON backup created successfully',
                backup: {
                    ...result.rows[0],
                    file_size_mb: backupResult.fileSizeMB
                }
            });
        }

        // Original pg_dump backup (requires PostgreSQL tools)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `wms_backup_${backup_type}_${timestamp}.sql`;
        const backupFilePath = path.join(BACKUP_DIR, backupFileName);

        console.log('🔄 Starting pg_dump backup...');

        // Parse database URL
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            return res.status(500).json({ error: 'Database URL not configured' });
        }

        // Parse connection string
        const urlParts = new URL(dbUrl);
        const host = urlParts.hostname;
        const port = urlParts.port || '5432';
        const database = urlParts.pathname.slice(1);
        const username = urlParts.username;
        const password = urlParts.password;

        // Build pg_dump command
        let dumpCommand = '';

        if (backup_type === 'schema') {
            // Schema only (structure without data)
            dumpCommand = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -d ${database} --schema-only -f "${backupFilePath}"`;
        } else if (backup_type === 'data') {
            // Data only (no structure)
            dumpCommand = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -d ${database} --data-only -f "${backupFilePath}"`;
        } else {
            // Full backup (schema + data)
            dumpCommand = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -d ${database} -f "${backupFilePath}"`;
        }

        // Execute backup
        await execPromise(dumpCommand);

        // Get file size
        const stats = fs.statSync(backupFilePath);
        const fileSizeInBytes = stats.size;
        const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);

        // Save backup metadata to database
        const result = await query(
            `INSERT INTO backups (
        file_name, 
        file_path, 
        file_size, 
        backup_type, 
        description, 
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *`,
            [
                backupFileName,
                backupFilePath,
                fileSizeInBytes,
                backup_type,
                description,
                user?.id || null
            ]
        );

        console.log(`✅ Backup created successfully: ${backupFileName} (${fileSizeInMB} MB)`);

        res.json({
            success: true,
            message: 'Backup created successfully',
            backup: {
                ...result.rows[0],
                file_size_mb: fileSizeInMB
            }
        });

    } catch (error: any) {
        console.error('❌ Backup creation error:', error);
        res.status(500).json({
            error: 'Backup failed',
            details: error.message,
            note: 'Make sure pg_dump is installed and accessible in PATH'
        });
    }
};

// ================= ASYNC BACKUP PROCESSOR =================
async function processBackupAsync(backupId: string, backup_type: string, description: string, userId: number | null) {
    try {
        backupProgress.set(backupId, {
            status: 'in_progress',
            progress: 10,
            message: 'Connecting to database...'
        });

        const backupResult = await createJSONBackup({
            includeUsers: backup_type === 'full',
            onProgress: (table, current, total) => {
                const percent = Math.round((current / total) * 100);
                backupProgress.set(backupId, {
                    status: 'in_progress',
                    progress: 10 + Math.round(percent * 0.8), // 10-90%
                    message: `Exporting ${table}: ${current}/${total} rows`
                });
            }
        });

        backupProgress.set(backupId, {
            status: 'in_progress',
            progress: 90,
            message: 'Saving backup metadata...'
        });

        // Upload to Cloudflare R2 (if configured)
        if (isR2Configured()) {
            backupProgress.set(backupId, {
                status: 'in_progress',
                progress: 92,
                message: 'Uploading to cloud storage...'
            });
            await uploadToR2(backupResult.filePath, backupResult.fileName);
        }

        // Save backup metadata to database
        const result = await query(
            `INSERT INTO backups (
                file_name, file_path, file_size, backup_type, description, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
                backupResult.fileName,
                backupResult.filePath,
                backupResult.fileSize,
                'json',
                description || 'JSON backup',
                userId
            ]
        );

        backupProgress.set(backupId, {
            status: 'completed',
            progress: 100,
            message: 'Backup completed successfully!',
            result: {
                ...result.rows[0],
                file_size_mb: backupResult.fileSizeMB,
                tableStats: backupResult.tableStats
            }
        });

        console.log(`✅ Async backup completed: ${backupResult.fileName} (${backupResult.fileSizeMB} MB)`);

        // Clean up progress after 10 minutes
        setTimeout(() => backupProgress.delete(backupId), 10 * 60 * 1000);

    } catch (error: any) {
        console.error('❌ Async backup error:', error);
        backupProgress.set(backupId, {
            status: 'failed',
            progress: 0,
            message: `Backup failed: ${error.message}`
        });
    }
}

// ================= CHECK BACKUP PROGRESS =================
export const getBackupProgress = async (req: Request, res: Response) => {
    try {
        const { backupId } = req.params;

        const progress = backupProgress.get(backupId);

        if (!progress) {
            return res.status(404).json({
                error: 'Backup not found or expired',
                message: 'Please check the backup list for completed backups'
            });
        }

        res.json(progress);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// ================= SELECTIVE BACKUP (Specific Tables) =================
export const createSelectiveBackup = async (req: Request, res: Response) => {
    try {
        const { tables, description = '' } = req.body;
        const user = (req as any).user;

        if (!tables || !Array.isArray(tables) || tables.length === 0) {
            return res.status(400).json({
                error: 'Please select at least one table/module to backup'
            });
        }

        // Valid tables for selective backup
        const validTables = [
            'warehouses', 'customers', 'racks', 'master_data',
            'inbound', 'qc', 'picking', 'outbound', 'users'
        ];

        const invalidTables = tables.filter((t: string) => !validTables.includes(t));
        if (invalidTables.length > 0) {
            return res.status(400).json({
                error: `Invalid tables: ${invalidTables.join(', ')}`
            });
        }

        console.log(`🔄 Creating selective backup for tables: ${tables.join(', ')}`);

        // Generate backup ID for tracking
        const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Initialize progress tracking
        backupProgress.set(backupId, {
            status: 'in_progress',
            progress: 0,
            message: 'Starting selective backup...'
        });

        // Send immediate response
        res.json({
            success: true,
            message: 'Selective backup started',
            backupId,
            tables,
            status: 'in_progress'
        });

        // Process backup in background
        processSelectiveBackupAsync(backupId, tables, description, user?.id);

    } catch (error: any) {
        console.error('❌ Selective backup error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Async selective backup processor
async function processSelectiveBackupAsync(
    backupId: string,
    tables: string[],
    description: string,
    userId: number | null
) {
    try {
        backupProgress.set(backupId, {
            status: 'in_progress',
            progress: 5,
            message: 'Preparing selective backup...'
        });

        const backupResult = await createJSONBackup({
            tables,
            onProgress: (table, current, total) => {
                const percent = Math.round((current / total) * 100);
                backupProgress.set(backupId, {
                    status: 'in_progress',
                    progress: 5 + Math.round(percent * 0.85),
                    message: `Exporting ${table}: ${current}/${total} rows`
                });
            }
        });

        backupProgress.set(backupId, {
            status: 'in_progress',
            progress: 92,
            message: 'Saving backup...'
        });

        // Save backup metadata
        const result = await query(
            `INSERT INTO backups (
                file_name, file_path, file_size, backup_type, description, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
                backupResult.fileName,
                backupResult.filePath,
                backupResult.fileSize,
                'json',
                description || `Selective backup: ${tables.join(', ')}`,
                userId
            ]
        );

        backupProgress.set(backupId, {
            status: 'completed',
            progress: 100,
            message: 'Selective backup completed!',
            result: {
                ...result.rows[0],
                file_size_mb: backupResult.fileSizeMB,
                tables_backed_up: tables
            }
        });

        console.log(`✅ Selective backup completed: ${backupResult.fileName}`);
        setTimeout(() => backupProgress.delete(backupId), 10 * 60 * 1000);

    } catch (error: any) {
        console.error('❌ Selective backup error:', error);
        backupProgress.set(backupId, {
            status: 'failed',
            progress: 0,
            message: `Backup failed: ${error.message}`
        });
    }
}

// ================= GET ALL BACKUPS =================
export const getAllBackups = async (req: Request, res: Response) => {
    try {
        const result = await query(
            `SELECT 
        id,
        file_name,
        file_size,
        backup_type,
        description,
        created_by,
        created_at,
        ROUND(file_size / 1024.0 / 1024.0, 2) as file_size_mb
      FROM backups 
      ORDER BY created_at DESC`
        );

        res.json(result.rows);
    } catch (error: any) {
        console.error('❌ Get backups error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ================= DOWNLOAD BACKUP FILE =================
export const downloadBackup = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await query(
            'SELECT file_name, file_path FROM backups WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        const backup = result.rows[0];
        const filePath = backup.file_path;

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Backup file not found on disk' });
        }

        res.download(filePath, backup.file_name);

    } catch (error: any) {
        console.error('❌ Download backup error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ================= DELETE BACKUP =================
export const deleteBackup = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await query(
            'SELECT file_path, file_name FROM backups WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        const backup = result.rows[0];
        const filePath = backup.file_path;
        const fileName = backup.file_name;

        // Delete from Cloudflare R2 (if configured)
        if (isR2Configured()) {
            await deleteFromR2(fileName);
        }

        // Delete file from local disk
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Delete record from database
        await query('DELETE FROM backups WHERE id = $1', [id]);

        console.log(`✅ Backup deleted: ${id}`);
        res.json({ message: 'Backup deleted successfully' });

    } catch (error: any) {
        console.error('❌ Delete backup error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ================= RESTORE DATABASE (ASYNC with Progress) =================
export const restoreBackup = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { confirm } = req.body;

        if (!confirm) {
            return res.status(400).json({
                error: 'Confirmation required',
                message: 'Please confirm that you want to restore the database.'
            });
        }

        const result = await query(
            'SELECT file_name, file_path, backup_type, file_size FROM backups WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        const backup = result.rows[0];
        const filePath = backup.file_path;

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Backup file not found on disk' });
        }

        // Generate restore ID for progress tracking
        const restoreId = `restore_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Initialize progress
        backupProgress.set(restoreId, {
            status: 'in_progress',
            progress: 0,
            message: 'Starting restore...'
        });

        // Send immediate response with restore ID
        res.json({
            success: true,
            message: 'Restore started in background',
            restoreId,
            status: 'in_progress'
        });

        // Process restore in background
        processRestoreAsync(restoreId, id, backup, filePath);

    } catch (error: any) {
        console.error('❌ Restore error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Async restore processor with progress tracking
async function processRestoreAsync(
    restoreId: string,
    backupId: string,
    backup: any,
    filePath: string
) {
    try {
        console.log('🔄 Starting async database restore...');

        backupProgress.set(restoreId, {
            status: 'in_progress',
            progress: 5,
            message: 'Reading backup file...'
        });

        // Check if it's a JSON backup
        if (backup.backup_type === 'json' || filePath.endsWith('.json')) {
            // Read file in chunks for large files
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const backupData = JSON.parse(fileContent);

            backupProgress.set(restoreId, {
                status: 'in_progress',
                progress: 10,
                message: 'Backup file loaded, preparing restore...'
            });

            const tables = Object.keys(backupData.data).filter(t => {
                const data = backupData.data[t];
                return Array.isArray(data) && data.length > 0;
            });

            const totalTables = tables.length;
            let completedTables = 0;
            const restoreResults: any = { success: [], failed: [], skipped: [] };

            // ULTRA-FAST: Much larger batch with bulk INSERT
            const BATCH_SIZE = 500; // 500 rows per single INSERT query

            // Calculate total rows for progress
            let totalRows = 0;
            let processedRows = 0;
            for (const tableName of tables) {
                totalRows += backupData.data[tableName].length;
            }

            console.log(`📦 FAST Restoring ${totalTables} tables with ${totalRows} total rows...`);

            // Restore each table
            for (const tableName of tables) {
                try {
                    const tableData = backupData.data[tableName];

                    backupProgress.set(restoreId, {
                        status: 'in_progress',
                        progress: 10 + Math.round((completedTables / totalTables) * 80),
                        message: `Restoring ${tableName} (${tableData.length} rows)...`,
                        details: {
                            currentTable: tableName,
                            completedTables,
                            totalTables,
                            processedRows,
                            totalRows
                        }
                    });

                    console.log(`  🔄 Restoring ${tableName} (${tableData.length} rows)...`);

                    // Clear existing data
                    await query(`DELETE FROM ${tableName}`);

                    // Get column names from first row
                    if (tableData.length === 0) continue;
                    const columns = Object.keys(tableData[0]);

                    // ULTRA-FAST: Bulk INSERT with multiple VALUES in single query
                    let insertedCount = 0;
                    for (let i = 0; i < tableData.length; i += BATCH_SIZE) {
                        const batch = tableData.slice(i, i + BATCH_SIZE);

                        // Build multi-value INSERT: INSERT INTO t (a,b) VALUES ($1,$2), ($3,$4), ...
                        const values: any[] = [];
                        const valueRows: string[] = [];
                        let paramIndex = 1;

                        for (const row of batch) {
                            const rowPlaceholders: string[] = [];
                            for (const col of columns) {
                                values.push(row[col]);
                                rowPlaceholders.push(`$${paramIndex++}`);
                            }
                            valueRows.push(`(${rowPlaceholders.join(', ')})`);
                        }

                        // Single INSERT with all rows - MUCH faster than row-by-row!
                        const bulkSQL = `
                            INSERT INTO ${tableName} (${columns.join(', ')})
                            VALUES ${valueRows.join(', ')}
                            ON CONFLICT DO NOTHING
                        `;

                        try {
                            await query(bulkSQL, values);
                            insertedCount += batch.length;
                            processedRows += batch.length;

                            // Update progress every batch
                            const overallProgress = 10 + Math.round((processedRows / totalRows) * 80);
                            backupProgress.set(restoreId, {
                                status: 'in_progress',
                                progress: overallProgress,
                                message: `Restoring ${tableName}: ${insertedCount}/${tableData.length} rows`,
                                details: {
                                    currentTable: tableName,
                                    tableProgress: Math.round((insertedCount / tableData.length) * 100),
                                    completedTables,
                                    totalTables,
                                    processedRows,
                                    totalRows
                                }
                            });

                        } catch (batchError: any) {
                            console.warn(`    ⚠️ Bulk insert error at row ${i}, falling back to individual inserts:`, batchError.message);

                            // Fallback: Insert rows individually on error (handles constraint issues)
                            for (const row of batch) {
                                try {
                                    const rowValues = columns.map(col => row[col]);
                                    const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
                                    await query(
                                        `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
                                        rowValues
                                    );
                                    insertedCount++;
                                    processedRows++;
                                } catch (rowError) {
                                    // Skip failed rows
                                }
                            }
                        }

                        // Allow event loop to breathe (less frequently now)
                        if (i % 2000 === 0) {
                            await new Promise(resolve => setImmediate(resolve));
                        }
                    }

                    console.log(`  ✅ Restored ${tableName}: ${insertedCount} rows`);
                    restoreResults.success.push({ table: tableName, rows: insertedCount });
                    completedTables++;

                } catch (err: any) {
                    console.warn(`  ⚠️ Failed to restore ${tableName}:`, err.message);
                    restoreResults.failed.push({ table: tableName, error: err.message });
                    completedTables++;
                }
            }

            // Log restore action
            await query(
                `INSERT INTO backup_restore_logs (backup_id, action, status, message) VALUES ($1, $2, $3, $4)`,
                [backupId, 'restore', 'success', `Restored: ${restoreResults.success.length} tables, ${processedRows} rows`]
            );

            backupProgress.set(restoreId, {
                status: 'completed',
                progress: 100,
                message: '✅ Database restored successfully!',
                result: {
                    success: restoreResults.success,
                    failed: restoreResults.failed,
                    skipped: restoreResults.skipped,
                    totalRows: processedRows,
                    fileName: backup.file_name
                }
            });

            console.log(`✅ Async restore completed: ${restoreResults.success.length} tables, ${processedRows} rows`);

        } else {
            // SQL restore not supported in async mode
            backupProgress.set(restoreId, {
                status: 'failed',
                progress: 0,
                message: 'SQL restore not supported. Please use JSON backups.'
            });
        }

        // Clean up progress after 10 minutes
        setTimeout(() => backupProgress.delete(restoreId), 10 * 60 * 1000);

    } catch (error: any) {
        console.error('❌ Async restore error:', error);

        // Log failed restore
        try {
            await query(
                `INSERT INTO backup_restore_logs (backup_id, action, status, message) VALUES ($1, $2, $3, $4)`,
                [backupId, 'restore', 'failed', error.message]
            );
        } catch (logError) {
            console.error('Failed to log restore error:', logError);
        }

        backupProgress.set(restoreId, {
            status: 'failed',
            progress: 0,
            message: `Restore failed: ${error.message}`
        });
    }
}

// ================= GET RESTORE LOGS =================
export const getRestoreLogs = async (req: Request, res: Response) => {
    try {
        const result = await query(
            `SELECT 
        l.*,
        b.file_name
      FROM backup_restore_logs l
      LEFT JOIN backups b ON l.backup_id = b.id
      ORDER BY l.created_at DESC
      LIMIT 50`
        );

        res.json(result.rows);
    } catch (error: any) {
        console.error('❌ Get restore logs error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ================= EXPORT BACKUP AS JSON =================
export const exportAsJSON = async (req: Request, res: Response) => {
    try {
        const { tables } = req.body; // Array of table names to export

        const exportData: any = {
            export_date: new Date().toISOString(),
            database: 'wms_database',
            tables: {}
        };

        const tablesToExport = tables && tables.length > 0
            ? tables
            : [
                'warehouses', 'users', 'customers', 'master_data',
                'inbound', 'qc', 'picking', 'outbound', 'racks'
            ];

        for (const tableName of tablesToExport) {
            try {
                const result = await query(`SELECT * FROM ${tableName}`);
                exportData.tables[tableName] = result.rows;
            } catch (err) {
                console.warn(`⚠️ Could not export table ${tableName}:`, err);
            }
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=wms_backup_${Date.now()}.json`);
        res.send(JSON.stringify(exportData, null, 2));

    } catch (error: any) {
        console.error('❌ JSON export error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ================= GET DATABASE STATISTICS =================
export const getDatabaseStats = async (req: Request, res: Response) => {
    try {
        const result = await query(`
      SELECT 
        schemaname as schema,
        tablename as table_name,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY size_bytes DESC
    `);

        const totalSize = await query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as total_size
    `);

        res.json({
            tables: result.rows,
            total_database_size: totalSize.rows[0].total_size
        });

    } catch (error: any) {
        console.error('❌ Database stats error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ================= BACKUP SCHEDULES MANAGEMENT =================

// Get all backup schedules
export const getAllSchedules = async (req: Request, res: Response) => {
    try {
        const result = await query(
            `SELECT 
                id, name, frequency, backup_type, description, enabled,
                time_of_day, day_of_week, day_of_month, retention_days,
                last_run_at, next_run_at, created_at, updated_at
            FROM backup_schedules 
            ORDER BY enabled DESC, id DESC`
        );

        res.json(result.rows);
    } catch (error: any) {
        console.error('❌ Get schedules error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Create new backup schedule
export const createSchedule = async (req: Request, res: Response) => {
    try {
        const {
            name,
            frequency,
            backup_type = 'full',
            description,
            enabled = true,
            time_of_day = '02:00:00',
            day_of_week = 0,
            day_of_month = 1,
            retention_days = 30
        } = req.body;
        const user = (req as any).user;

        if (!name || !frequency) {
            return res.status(400).json({ error: 'Name and frequency are required' });
        }

        const result = await query(
            `INSERT INTO backup_schedules (
                name, frequency, backup_type, description, enabled,
                time_of_day, day_of_week, day_of_month, retention_days, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [name, frequency, backup_type, description, enabled,
                time_of_day, day_of_week, day_of_month, retention_days, user?.id || null]
        );

        const schedule = result.rows[0];

        // Schedule the backup if enabled
        if (enabled) {
            await backupScheduler.reloadSchedule(schedule.id);
        }

        res.json({
            success: true,
            message: 'Backup schedule created successfully',
            schedule
        });
    } catch (error: any) {
        console.error('❌ Create schedule error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update backup schedule
export const updateSchedule = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const {
            name,
            frequency,
            backup_type,
            description,
            enabled,
            time_of_day,
            day_of_week,
            day_of_month,
            retention_days
        } = req.body;

        const result = await query(
            `UPDATE backup_schedules SET
                name = COALESCE($1, name),
                frequency = COALESCE($2, frequency),
                backup_type = COALESCE($3, backup_type),
                description = COALESCE($4, description),
                enabled = COALESCE($5, enabled),
                time_of_day = COALESCE($6, time_of_day),
                day_of_week = COALESCE($7, day_of_week),
                day_of_month = COALESCE($8, day_of_month),
                retention_days = COALESCE($9, retention_days),
                updated_at = NOW()
            WHERE id = $10
            RETURNING *`,
            [name, frequency, backup_type, description, enabled,
                time_of_day, day_of_week, day_of_month, retention_days, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        // Reload the schedule
        await backupScheduler.reloadSchedule(parseInt(id));

        res.json({
            success: true,
            message: 'Schedule updated successfully',
            schedule: result.rows[0]
        });
    } catch (error: any) {
        console.error('❌ Update schedule error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Delete backup schedule
export const deleteSchedule = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Cancel the scheduled job
        backupScheduler.cancelSchedule(parseInt(id));

        // Delete from database
        const result = await query(
            'DELETE FROM backup_schedules WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        res.json({
            success: true,
            message: 'Schedule deleted successfully'
        });
    } catch (error: any) {
        console.error('❌ Delete schedule error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Toggle schedule enabled/disabled
export const toggleSchedule = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;

        const result = await query(
            `UPDATE backup_schedules SET enabled = $1, updated_at = NOW() 
             WHERE id = $2 RETURNING *`,
            [enabled, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        // Reload the schedule
        await backupScheduler.reloadSchedule(parseInt(id));

        res.json({
            success: true,
            message: `Schedule ${enabled ? 'enabled' : 'disabled'} successfully`,
            schedule: result.rows[0]
        });
    } catch (error: any) {
        console.error('❌ Toggle schedule error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get backup health statistics
export const getHealthStats = async (req: Request, res: Response) => {
    try {
        // Update stats first
        await query('SELECT update_backup_health_stats()');

        // Get stats
        const result = await query('SELECT * FROM backup_health_stats WHERE id = 1');

        if (result.rows.length === 0) {
            return res.json({
                total_backups: 0,
                successful_backups: 0,
                failed_backups: 0,
                last_backup_at: null,
                last_backup_status: null,
                last_backup_size: 0,
                total_storage_used: 0,
                average_backup_size: 0,
                success_rate: 0
            });
        }

        const stats = result.rows[0];

        // Add formatted sizes
        const formatBytes = (bytes: number) => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
        };

        res.json({
            ...stats,
            total_storage_used_formatted: formatBytes(stats.total_storage_used || 0),
            average_backup_size_formatted: formatBytes(stats.average_backup_size || 0),
            last_backup_size_formatted: formatBytes(stats.last_backup_size || 0)
        });
    } catch (error: any) {
        console.error('❌ Get health stats error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get scheduler status
export const getSchedulerStatus = async (req: Request, res: Response) => {
    try {
        const status = backupScheduler.getStatus();
        res.json(status);
    } catch (error: any) {
        console.error('❌ Get scheduler status error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Manual trigger of scheduled backup
export const triggerScheduledBackup = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await query(
            'SELECT * FROM backup_schedules WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        const schedule = result.rows[0];

        // Create backup immediately
        const backupResult = await createJSONBackup({
            includeUsers: schedule.backup_type === 'full'
        });

        // Save backup metadata
        await query(
            `INSERT INTO backups (
                file_name, file_path, file_size, backup_type, description, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                backupResult.fileName,
                backupResult.filePath,
                backupResult.fileSize,
                'json',
                `${schedule.description || 'Manual trigger'} (${schedule.name})`,
                (req as any).user?.id || null
            ]
        );

        res.json({
            success: true,
            message: 'Backup triggered successfully',
            backup: backupResult
        });
    } catch (error: any) {
        console.error('❌ Trigger scheduled backup error:', error);
        res.status(500).json({ error: error.message });
    }
};

