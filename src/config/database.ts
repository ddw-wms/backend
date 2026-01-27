// File Path = warehouse-backend/src/config/database.ts
import { Pool } from 'pg';
import dns from 'dns';
import logger from '../utils/logger';

dns.setDefaultResultOrder('ipv4first');

let pool: Pool | null = null;
let reconnecting = false;
let dbReady = false;
let lastSuccessfulQuery: Date | null = null;
let healthCheckInterval: NodeJS.Timeout | null = null;
let keepAliveInterval: NodeJS.Timeout | null = null;

// Configuration
const HEALTH_CHECK_INTERVAL = 15000; // 15 seconds - more frequent
const KEEP_ALIVE_INTERVAL = 45000; // 45 seconds - keep connection warm
const MAX_RECONNECT_ATTEMPTS = 10;

// Create a new pool with optimized settings
function createPool(dbUrl: string): Pool {
  const isPgBouncer = dbUrl.includes('pgbouncer=true') || dbUrl.includes(':6543');

  return new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },

    // Connection settings - CRITICAL for Supabase
    keepAlive: true,
    keepAliveInitialDelayMillis: 5000, // Start keepalive quickly

    // Pool settings - conservative for stability
    max: 3,  // Fewer connections = more stable
    min: 0,  // Allow pool to shrink
    idleTimeoutMillis: 60000, // 1 minute idle
    connectionTimeoutMillis: 30000, // 30 sec to connect
    allowExitOnIdle: false,

    // For PgBouncer transaction mode
    ...(isPgBouncer && {
      application_name: 'wms_backend',
    }),
  });
}

export const initializeDatabase = async (): Promise<Pool> => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    logger.error("DATABASE_URL not set");
    process.exit(1);
  }

  // Already connected and healthy
  if (pool && dbReady) {
    return pool;
  }

  // Cleanup old pool
  if (pool) {
    try { await pool.end(); } catch { }
    pool = null;
  }

  logger.info("Initializing database connection...");

  const newPool = createPool(dbUrl);

  // Test connection
  try {
    const result = await newPool.query("SELECT NOW() as time");
    logger.info("Database Connected", { time: result.rows[0].time });

    pool = newPool;
    dbReady = true;
    lastSuccessfulQuery = new Date();

    // Setup error handler
    pool.on("error", (err) => {
      logger.error("Pool error", { message: err.message });
      triggerReconnect();
    });

    // Start health monitoring
    startHealthMonitoring();

    return pool;
  } catch (err: any) {
    logger.error("Connection failed", { error: err.message });
    try { await newPool.end(); } catch { }
    throw err;
  }
};

// Health monitoring - detect and fix silent disconnections
function startHealthMonitoring() {
  // Clear existing intervals
  if (healthCheckInterval) clearInterval(healthCheckInterval);
  if (keepAliveInterval) clearInterval(keepAliveInterval);

  // Health check - verify connection works
  healthCheckInterval = setInterval(async () => {
    if (!pool || reconnecting) return;

    try {
      const start = Date.now();
      await pool.query("SELECT 1");
      const latency = Date.now() - start;

      lastSuccessfulQuery = new Date();

      // Log if latency is high
      if (latency > 5000) {
        logger.warn("High database latency", { latency });
      }
    } catch (err: any) {
      logger.warn("Health check failed", { error: err.message });
      triggerReconnect();
    }
  }, HEALTH_CHECK_INTERVAL);

  // Keep-alive ping - prevent idle disconnection
  keepAliveInterval = setInterval(async () => {
    if (!pool || !dbReady || reconnecting) return;

    try {
      // Simple ping to keep connection warm
      await pool.query("SELECT 1");
    } catch {
      // Ignore - health check will handle it
    }
  }, KEEP_ALIVE_INTERVAL);

  // Allow process to exit
  healthCheckInterval.unref();
  keepAliveInterval.unref();
}

// Reconnection handler
async function triggerReconnect() {
  if (reconnecting) return;

  reconnecting = true;
  dbReady = false;

  logger.info("Starting database reconnection...");

  // Stop monitoring during reconnect
  if (healthCheckInterval) clearInterval(healthCheckInterval);
  if (keepAliveInterval) clearInterval(keepAliveInterval);

  // Close old pool
  const oldPool = pool;
  pool = null;
  try { await oldPool?.end(); } catch { }

  // Reconnect with retries
  for (let attempt = 1; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
    try {
      await initializeDatabase();
      logger.info("Database reconnected", { attempt });
      reconnecting = false;
      return;
    } catch (err: any) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      logger.warn(`Reconnect attempt ${attempt} failed, retrying in ${delay}ms...`, {
        error: err.message,
      });
      await new Promise(r => setTimeout(r, delay));
    }
  }

  logger.error("All reconnection attempts failed");
  reconnecting = false;
}

// Get pool - throws if not ready
export const getPool = (): Pool => {
  if (!pool || !dbReady) {
    throw new Error("Database not ready");
  }
  return pool;
};

// Query with automatic retry
export const query = async (text: string, params?: any[], maxRetries = 2) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Wait for reconnection if in progress
      if (reconnecting) {
        await new Promise(r => setTimeout(r, 1000));
        if (reconnecting) continue;
      }

      const p = getPool();
      const result = await p.query(text, params);
      lastSuccessfulQuery = new Date();
      return result;

    } catch (error: any) {
      // Don't retry constraint/syntax errors
      const noRetry = ['23505', '23503', '42601', '42501'].includes(error.code);
      if (noRetry) throw error;

      // Connection error - trigger reconnect
      const isConnError =
        error.message?.includes('not ready') ||
        error.message?.includes('Connection terminated') ||
        error.message?.includes('ECONNRESET') ||
        error.code === '57P01';

      if (isConnError && !reconnecting) {
        triggerReconnect();
      }

      // Last attempt - throw
      if (attempt >= maxRetries) throw error;

      // Wait before retry
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }

  throw new Error("Query failed after retries");
};

export const isDbReady = () => dbReady;

export const getConnectionStatus = () => ({
  ready: dbReady,
  reconnecting,
  lastSuccessfulQuery,
});

export default { initializeDatabase, getPool, query, isDbReady, getConnectionStatus };
