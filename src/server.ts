// File Path = warehouse-backend/src/server.ts
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env from project root or fallback to repo's safe_secrets/.env for local dev (do NOT commit secrets)
const standardEnv = path.join(process.cwd(), '.env');
const safeEnv = path.join(process.cwd(), '..', 'safe_secrets', '.env');
const envPath = fs.existsSync(standardEnv) ? standardEnv : (fs.existsSync(safeEnv) ? safeEnv : undefined);
dotenv.config(envPath ? { path: envPath } : undefined);

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { initializeDatabase } from './config/database';
import authRoutes from './routes/auth.routes';
import warehousesRoutes from './routes/warehouses.routes';
import inboundRoutes from './routes/inbound.routes';
import masterDataRoutes from './routes/master-data.routes';
import usersRoutes from './routes/users.routes';
import rackRoutes from './routes/rack.routes';
import qcRoutes from './routes/qc.routes';
import pickingRoutes from './routes/picking.routes';
import { errorHandler } from './middleware/errorHandler.middleware';
import outboundRoutes from './routes/outbound.routes';
import customerRoutes from './routes/customer.routes';
import dashboardRoutes from './routes/dashboard.routes';
import inventoryRoutes from './routes/inventory.routes';
import reportsRoutes from './routes/reports.routes';
import backupRoutes from './routes/backup.routes';
import debugRoutes from './routes/debug.routes';
import permissionsRoutes from './routes/permissions.routes';
import { isDbReady } from "./config/database";
import { apiTimeout } from './middleware/timeout.middleware';
import { backupScheduler } from './services/backupScheduler';



const app: Express = express();
//const PORT = process.env.PORT || 5000;
const PORT = Number(process.env.PORT) || 3000;


// CORS (MUST BE FIRST)
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://192.168.1.8:3000',
    'http://192.168.29.166:3000',
    'https://ddwms.vercel.app',
    'http://127.0.0.1:9100'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 🚧 Ensure DB is ready before hitting any API (skip check in tests)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'test') return next();
  if (!isDbReady()) {
    return res.status(503).json({
      error: "Database not ready. Reconnecting...",
      timestamp: new Date()
    });
  }
  next();
});

// Request timeout (30 seconds for all requests)
app.use(apiTimeout);

app.use(express.urlencoded({ limit: '1000mb', extended: true }));
app.use(express.json({ limit: '1000mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve Print Agent installer (from Cloudflare R2)
app.get('/downloads/print-agent', async (req: Request, res: Response) => {
  try {
    const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

    // Check if R2 is configured
    if (!process.env.CLOUDFLARE_R2_ACCOUNT_ID || !process.env.CLOUDFLARE_R2_ACCESS_KEY) {
      // Fallback to local file
      const installerPath = path.join(__dirname, '../installers/WMS-Print-Agent-Setup.exe');
      if (fs.existsSync(installerPath)) {
        return res.download(installerPath, 'WMS-Print-Agent-Setup.exe');
      }
      return res.status(404).json({ error: 'Print Agent installer not found' });
    }

    // Download from Cloudflare R2
    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY,
      },
    });

    const bucketName = process.env.CLOUDFLARE_R2_BUCKET || 'wms-backups';
    const fileName = 'WMS Print Agent Setup 1.0.0.exe';

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileName,
    });

    const response = await r2Client.send(command);

    if (response.Body) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', response.ContentLength || 0);

      // Stream the file
      const stream = response.Body as any;
      stream.pipe(res);
    } else {
      res.status(404).json({ error: 'File not found in cloud storage' });
    }

  } catch (error: any) {
    console.error('Print Agent download error:', error);
    res.status(500).json({ error: 'Download failed', details: error.message });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/warehouses', warehousesRoutes);
app.use('/api/inbound', inboundRoutes);
app.use('/api/master-data', masterDataRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/racks', rackRoutes);
app.use('/api/qc', qcRoutes);
app.use('/api/picking', pickingRoutes);
app.use('/api/outbound', outboundRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/inventory', inventoryRoutes);

app.use('/api/reports', reportsRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/permissions', permissionsRoutes);


// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error Handler
app.use(errorHandler);

// Start Server (skip real DB init and listen when running tests)
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      await initializeDatabase();

      // Initialize backup scheduler
      await backupScheduler.initialize();

      app.listen(PORT, () => {
        console.log(`✓ Server running on port ${PORT}`);
      });
    } catch (err) {
      console.error('❌ Failed to start server:', err);
      process.exit(1);
    }
  })();
} else {
  // In test environment, avoid starting DB connection and listener.
  // Tests set NODE_ENV=test and should stub or avoid DB access.
}

// (async () => {
//   try {
//     await initializeDatabase();
//     app.listen(PORT, "0.0.0.0", () => {
//       console.log(`✓ Server running on port ${PORT}`);
//     });

//   } catch (err) {
//     console.error('❌ Failed to start server:', err);
//     process.exit(1);
//   }
// })();

export default app;
