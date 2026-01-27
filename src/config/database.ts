// File Path = warehouse-backend/src/config/database.ts
import { Pool, PoolClient } from 'pg';
import dns from 'dns';
import logger from '../utils/logger';

dns.setDefaultResultOrder('ipv4first');

let pool: Pool | null = null;
let reconnecting = false;
let dbReady = false;
let lastHealthCheck: Date | null = null;
let healthCheckInterval: NodeJS.Timeout | null = null;

// Health check configuration
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const CONNECTION_RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Progressive backoff

export const initializeDatabase = async (retryAttempt = 0): Promise<Pool> => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    logger.error("DATABASE_URL not set");
    process.exit(1);
  }

  if (pool && dbReady) return pool;

  logger.info("Initializing database pool...", { attempt: retryAttempt + 1 });

  const isPgBouncer = dbUrl.includes('pgbouncer=true') || dbUrl.includes(':6543');

  const newPool = new Pool({
    connectionString: dbUrl,
    // SSL configuration - Supabase uses self-signed certs, so we must allow them
    ssl: process.env.DB_SSL_CA
      ? { rejectUnauthorized: true, ca: process.env.DB_SSL_CA }
      : { rejectUnauthorized: false },

    // MOST IMPORTANT for Supabase/Remote DB:
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,

    // Pool configuration - OPTIMIZED for Supabase PRO TIER
    max: isPgBouncer ? 5 : 10,   // More connections for Pro tier
    min: 1,    // Keep at least 1 connection alive
    idleTimeoutMillis: 30000,   // 30 seconds idle timeout
    connectionTimeoutMillis: 30000,  // 30 seconds to connect
    allowExitOnIdle: false,  // Keep pool alive

    // CRITICAL for Supabase Transaction Mode (PgBouncer)
    ...(isPgBouncer && {
      statement_timeout: undefined,
      query_timeout: undefined,
    }),
  });

  // Test connection before assigning
  try {
    const test = await newPool.query("SELECT NOW() as time, current_database() as db");
    logger.info("Database Connected Successfully", {
      connectedAt: test.rows[0].time,
      database: test.rows[0].db,
      isPgBouncer,
    });

    pool = newPool;
    dbReady = true;
    lastHealthCheck = new Date();

    // Set up error handler
    newPool.on("error", handlePoolError);

    // Start periodic health checks
    startHealthCheck();

    return pool;
  } catch (err: any) {
    logger.error("Database connection failed", {
      error: err.message,
      code: err.code,
      attempt: retryAttempt + 1,
    });
    dbReady = false;

    // Progressive retry with backoff
    const delay = CONNECTION_RETRY_DELAYS[Math.min(retryAttempt, CONNECTION_RETRY_DELAYS.length - 1)];
    logger.info(`Retrying database connection in ${delay}ms...`);

    await new Promise(resolve => setTimeout(resolve, delay));
    return initializeDatabase(retryAttempt + 1);
  }
};

// Periodic health check to detect silent disconnections
function startHealthCheck() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  healthCheckInterval = setInterval(async () => {
    if (!pool || !dbReady) return;

    try {
      await pool.query("SELECT 1");
      lastHealthCheck = new Date();
    } catch (err: any) {
      logger.warn("Health check failed", { error: err.message });
      handlePoolError(err);
    }
  }, HEALTH_CHECK_INTERVAL);

  // Don't prevent process exit
  healthCheckInterval.unref();
}

async function handlePoolError(err: Error) {
  logger.warn("Database pool error", { message: err.message });

  if (reconnecting) return;
  reconnecting = true;
  dbReady = false;

  logger.info("Attempting to reconnect...");

  // Stop health checks during reconnection
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }

  try {
    await pool?.end();
  } catch { }

  pool = null;

  // Attempt reconnection with progressive backoff
  let attempt = 0;
  while (!dbReady) {
    try {
      await initializeDatabase(attempt);
      logger.info("Database reconnected successfully");
      break;
    } catch (e: any) {
      attempt++;
      const delay = CONNECTION_RETRY_DELAYS[Math.min(attempt, CONNECTION_RETRY_DELAYS.length - 1)];
      logger.error("Reconnection failed, retrying...", {
        error: e.message,
        nextAttemptIn: delay,
        attempt: attempt + 1,
      });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  reconnecting = false;
}

export const getPool = (): Pool => {
  if (!dbReady || !pool) {
    throw new Error("Database not ready. Please wait while we reconnect...");
  }
  return pool;
};

export const query = async (text: string, params?: any[], retries = 3) => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const p = getPool();
      return await p.query(text, params);
    } catch (error: any) {
      lastError = error;

      // Don't retry on syntax errors or constraint violations
      if (error.code === '42601' || error.code === '23505' || error.code === '23503') {
        throw error;
      }

      // Check if it's a connection error that needs pool reconnection
      const isConnectionError =
        error.message?.includes('Database not ready') ||
        error.message?.includes('timeout') ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('connection') ||
        error.message?.includes('terminating connection') ||
        error.code === '57P01' || // admin_shutdown
        error.code === '57P02' || // crash_shutdown
        error.code === '57P03';   // cannot_connect_now

      if (isConnectionError) {
        // Trigger reconnection if not already happening
        if (!reconnecting && pool) {
          handlePoolError(error);
        }
      }

      // Retry with exponential backoff
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        logger.warn(`Query attempt ${attempt + 1} failed, retrying in ${delay}ms...`, {
          error: error.message,
          code: error.code,
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
};

// Simple query without retry (for performance-critical operations)
export const queryNoRetry = async (text: string, params?: any[]) => {
  const p = getPool();
  return p.query(text, params);
};

export const isDbReady = () => dbReady;

export const getConnectionStatus = () => ({
  ready: dbReady,
  reconnecting,
  lastHealthCheck,
});

export default {
  initializeDatabase,
  getPool,
  query,
  isDbReady,
  getConnectionStatus,
};
