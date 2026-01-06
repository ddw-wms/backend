// File Path = warehouse-backend/src/controllers/backup.controller.ts
import { Request, Response } from 'express';
import { query, getPool } from '../config/database';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createJSONBackup, exportTableAsCSV, getDatabaseStatistics } from '../utils/supabaseBackup';

const execPromise = promisify(exec);

const BACKUP_DIR = path.join(__dirname, '../../backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// ================= CREATE DATABASE BACKUP =================
export const createBackup = async (req: Request, res: Response) => {
    try {
        const { backup_type = 'full', description = '', use_json = true } = req.body;
        const user = (req as any).user;

        // If JSON backup is requested (works on Supabase)
        if (use_json || backup_type === 'json') {
            console.log('🔄 Creating JSON backup (Supabase-friendly)...');

            const backupResult = await createJSONBackup({
                includeUsers: backup_type === 'full'
            });

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
        console.log('🔍 Download request for backup ID:', id);

        const result = await query(
            'SELECT file_name, file_path FROM backups WHERE id = $1',
            [id]
        );

        console.log('📊 Query result:', result.rows.length, 'rows found');

        if (result.rows.length === 0) {
            console.log('❌ Backup not found in database');
            return res.status(404).json({ error: 'Backup not found' });
        }

        const backup = result.rows[0];
        const filePath = backup.file_path;
        console.log('📁 File path:', filePath);
        console.log('📁 File exists:', fs.existsSync(filePath));

        if (!fs.existsSync(filePath)) {
            console.log('❌ Backup file not found on disk');
            return res.status(404).json({ error: 'Backup file not found on disk' });
        }

        console.log('✅ Sending file:', backup.file_name);
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
            'SELECT file_path FROM backups WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        const filePath = result.rows[0].file_path;

        // Delete file from disk
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

// ================= RESTORE DATABASE =================
export const restoreBackup = async (req: Request, res: Response) => {
    let backup: any = null;
    try {
        const { id } = req.params;
        const { confirm } = req.body;

        if (!confirm) {
            return res.status(400).json({
                error: 'Confirmation required',
                message: 'Please confirm that you want to restore the database. This will overwrite current data.'
            });
        }

        const result = await query(
            'SELECT file_name, file_path, backup_type FROM backups WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        backup = result.rows[0];
        const filePath = backup.file_path;

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Backup file not found on disk' });
        }

        console.log('🔄 Starting database restore...');

        // Check if it's a JSON backup
        if (backup.backup_type === 'json' || filePath.endsWith('.json')) {
            // JSON Restore - works without psql
            const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            console.log('📦 Restoring from JSON backup...');

            // Restore each table
            for (const tableName of Object.keys(backupData.data)) {
                try {
                    const tableData = backupData.data[tableName];

                    if (tableData.error || !Array.isArray(tableData) || tableData.length === 0) {
                        console.log(`⏭️ Skipping ${tableName} (no data)`);
                        continue;
                    }

                    console.log(`  🔄 Restoring ${tableName}...`);

                    // Clear existing data (be careful!)
                    await query(`DELETE FROM ${tableName}`);

                    // Insert data row by row
                    for (const row of tableData) {
                        const columns = Object.keys(row);
                        const values = Object.values(row);
                        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

                        const insertSQL = `
              INSERT INTO ${tableName} (${columns.join(', ')})
              VALUES (${placeholders})
              ON CONFLICT DO NOTHING
            `;

                        await query(insertSQL, values);
                    }

                    console.log(`  ✅ Restored ${tableName}: ${tableData.length} rows`);
                } catch (err: any) {
                    console.warn(`  ⚠️ Failed to restore ${tableName}:`, err.message);
                }
            }

            // Log restore action
            await query(
                `INSERT INTO backup_restore_logs (
          backup_id, 
          action, 
          status, 
          message
        ) VALUES ($1, $2, $3, $4)`,
                [id, 'restore', 'success', `Database restored from JSON backup: ${backup.file_name}`]
            );

            console.log(`✅ JSON restore completed successfully`);

            return res.json({
                success: true,
                message: 'Database restored successfully from JSON backup',
                backup: backup.file_name
            });
        }

        // SQL Restore (original method - requires psql)
        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            return res.status(500).json({ error: 'Database URL not configured' });
        }

        const urlParts = new URL(dbUrl);
        const host = urlParts.hostname;
        const port = urlParts.port || '5432';
        const database = urlParts.pathname.slice(1);
        const username = urlParts.username;
        const password = urlParts.password;

        // Build psql restore command
        const restoreCommand = `PGPASSWORD="${password}" psql -h ${host} -p ${port} -U ${username} -d ${database} -f "${filePath}"`;

        // Execute restore
        await execPromise(restoreCommand);

        // Log restore action
        await query(
            `INSERT INTO backup_restore_logs (
        backup_id, 
        action, 
        status, 
        message
      ) VALUES ($1, $2, $3, $4)`,
            [id, 'restore', 'success', `Database restored from ${backup.file_name}`]
        );

        console.log(`✅ Database restored successfully from: ${backup.file_name}`);

        res.json({
            success: true,
            message: 'Database restored successfully',
            backup: backup.file_name
        });

    } catch (error: any) {
        console.error('❌ Restore error:', error);

        // Log failed restore
        try {
            await query(
                `INSERT INTO backup_restore_logs (
          backup_id, 
          action, 
          status, 
          message
        ) VALUES ($1, $2, $3, $4)`,
                [req.params.id, 'restore', 'failed', error.message]
            );
        } catch (logError) {
            console.error('Failed to log restore error:', logError);
        }

        res.status(500).json({
            error: 'Restore failed',
            details: error.message,
            note: backup?.backup_type === 'json'
                ? 'JSON restore failed - check server logs for details'
                : 'Make sure psql is installed and accessible in PATH'
        });
    }
};

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
