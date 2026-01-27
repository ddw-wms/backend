// File Path = warehouse-backend/src/config/database.ts
import { Pool, PoolClient } from 'pg';
import dns from 'dns';
import logger from '../utils/logger';

dns.setDefaultResultOrder('ipv4first');

let pool: Pool | null = null;
let reconnecting = false;
let dbReady = false;
let lastSuccessfulQuery: Date | null = null;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_BASE = 2000; // Start with 2 seconds

// Track connection health
interface ConnectionHealth {
  isHealthy: boolean;
  lastCheck: Date | null;
  consecutiveFailures: number;
  lastError: string | null;
}

let connectionHealth: ConnectionHealth = {
  isHealthy: false,
  lastCheck: null,
  consecutiveFailures: 0,
  lastError: null,
};

export const getConnectionHealth = () => ({ ...connectionHealth, dbReady, lastSuccessfulQuery });

export const initializeDatabase = async (retryCount = 0): Promise<Pool> => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    logger.error("DATABASE_URL not set");
    throw new Error("DATABASE_URL environment variable is not set");
  }

  if (pool && dbReady) return pool;

  logger.info("Initializing database pool...", { attempt: retryCount + 1 });

  const isPgBouncer = dbUrl.includes('pgbouncer=true') || dbUrl.includes(':6543');

  const newPool = new Pool({
    connectionString: dbUrl,
    // SSL configuration - Supabase uses self-signed certs, so we must allow them
    // For strict SSL with custom CA, set DB_SSL_CA environment variable
    ssl: process.env.DB_SSL_CA
      ? { rejectUnauthorized: true, ca: process.env.DB_SSL_CA }
      : { rejectUnauthorized: false },

    // MOST IMPORTANT for Supabase/Remote DB:
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,

    // Pool configuration - OPTIMIZED for Supabase PRO + Render Free
    max: isPgBouncer ? 5 : 8,   // Slightly more connections for Pro tier
    min: 0,    // Don't require minimum connections during cold start
    idleTimeoutMillis: 30000,   // Keep connections for 30 seconds
    connectionTimeoutMillis: 15000,  // 15 seconds - fail fast, retry quick
    allowExitOnIdle: false,  // Keep pool alive even when idle

    // CRITICAL for Supabase Transaction Mode (PgBouncer)
    // Disable prepared statements - they don't work with PgBouncer transaction mode
    ...(isPgBouncer && {
      statement_timeout: undefined,
      query_timeout: undefined,
    }),
  });

  // test connection before assigning
  try {
    const test = await newPool.query("SELECT NOW()");
    logger.info("Database Connected Successfully", { connectedAt: test.rows[0].now });

    pool = newPool;
    dbReady = true;
    connectionAttempts = 0;
    connectionHealth = {
      isHealthy: true,
      lastCheck: new Date(),
      consecutiveFailures: 0,
      lastError: null,
    };
    lastSuccessfulQuery = new Date();

    newPool.on("error", handlePoolError);

    // Start periodic health check
    startHealthCheck();

    return pool;
  } catch (err: any) {
    logger.error("Database connection failed", err as Error, { attempt: retryCount + 1 });
    dbReady = false;
    connectionHealth = {
      isHealthy: false,
      lastCheck: new Date(),
      consecutiveFailures: connectionHealth.consecutiveFailures + 1,
      lastError: err.message,
    };

    // Exponential backoff for reconnection
    if (retryCount < MAX_RECONNECT_ATTEMPTS) {
      const delay = RECONNECT_DELAY_BASE * Math.pow(2, retryCount);
      logger.info(`Retrying database connection in ${delay}ms...`, { attempt: retryCount + 1 });
      await new Promise(resolve => setTimeout(resolve, delay));
      return initializeDatabase(retryCount + 1);
    }

    throw err;
  }
};

// Periodic health check to maintain connection
let healthCheckInterval: NodeJS.Timeout | null = null;

function startHealthCheck() {
  if (healthCheckInterval) clearInterval(healthCheckInterval);

  // Check connection health every 30 seconds
  healthCheckInterval = setInterval(async () => {
    if (!pool || !dbReady) return;

    try {
      await pool.query("SELECT 1");
      connectionHealth.isHealthy = true;
      connectionHealth.lastCheck = new Date();
      connectionHealth.consecutiveFailures = 0;
      lastSuccessfulQuery = new Date();
    } catch (err: any) {
      logger.warn("Health check failed", { error: err.message });
      connectionHealth.consecutiveFailures++;
      connectionHealth.lastError = err.message;

      // If 3 consecutive failures, trigger reconnection
      if (connectionHealth.consecutiveFailures >= 3) {
        connectionHealth.isHealthy = false;
        handlePoolError(err);
      }
    }
  }, 30000);
}

async function handlePoolError(err: Error) {
  logger.warn("Database pool error", { message: err.message });

  if (reconnecting) return;
  reconnecting = true;
  dbReady = false;
  connectionHealth.isHealthy = false;

  logger.info("Attempting to reconnect with exponential backoff...");

  try {
    await pool?.end();
  } catch { }

  pool = null;

  // Reconnect with exponential backoff
  const reconnect = async (attempt = 0) => {
    if (attempt >= MAX_RECONNECT_ATTEMPTS) {
      logger.error("Max reconnection attempts reached. Manual intervention required.");
      reconnecting = false;
      return;
    }

    const delay = RECONNECT_DELAY_BASE * Math.pow(2, attempt);
    logger.info(`Reconnection attempt ${attempt + 1} in ${delay}ms...`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await initializeDatabase();
      logger.info("Database reconnected successfully");
      reconnecting = false;
    } catch (e: any) {
      logger.error("Reconnection failed", e as Error, { attempt: attempt + 1 });
      await reconnect(attempt + 1);
    }
  };

  reconnect();
}

// Force reconnection (can be called from health endpoint)
export const forceReconnect = async (): Promise<boolean> => {
  logger.info("Forcing database reconnection...");

  try {
    if (pool) {
      await pool.end();
    }
  } catch { }

  pool = null;
  dbReady = false;
  reconnecting = false;

  try {
    await initializeDatabase();
    return true;
  } catch (err) {
    logger.error("Force reconnection failed", err as Error);
    return false;
  }
};

// Warm up connection (call on first request after cold start)
export const warmupConnection = async (): Promise<boolean> => {
  // If database is already ready, just verify it works
  if (pool && dbReady) {
    try {
      await pool.query("SELECT 1");
      lastSuccessfulQuery = new Date();
      connectionHealth.isHealthy = true;
      return true;
    } catch (err: any) {
      logger.warn("Warmup query failed, attempting reconnection", { error: err.message });
      // Fall through to reconnection
    }
  }

  // Try to initialize/reconnect
  try {
    await initializeDatabase();

    if (pool) {
      await pool.query("SELECT 1");
      lastSuccessfulQuery = new Date();
      connectionHealth.isHealthy = true;
      return true;
    }
    return false;
  } catch (err: any) {
    logger.warn("Warmup failed", { error: err.message });
    return false;
  }
};

export const getPool = (): Pool => {
  if (!dbReady || !pool) {
    throw new Error("Database not ready. The server is reconnecting. Please try again in a moment.");
  }
  return pool;
};

export const query = async (text: string, params?: any[], retries = 3) => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const p = getPool();
      const result = await p.query(text, params);

      // Update health tracking on success
      lastSuccessfulQuery = new Date();
      connectionHealth.isHealthy = true;
      connectionHealth.consecutiveFailures = 0;

      return result;
    } catch (error: any) {
      lastError = error;

      // Don't retry on syntax errors or constraint violations
      if (error.code === '42601' || error.code === '23505' || error.code === '23503') {
        throw error;
      }

      // Retry on connection/timeout errors with exponential backoff
      const isRetryableError = (
        error.message?.includes('timeout') ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('connection') ||
        error.message?.includes('Database not ready') ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === '57P01' || // admin_shutdown
        error.code === '57P02' || // crash_shutdown
        error.code === '57P03'    // cannot_connect_now
      );

      if (attempt < retries && isRetryableError) {
        const delay = 1000 * Math.pow(2, attempt); // Exponential backoff: 1s, 2s, 4s
        logger.warn(`Query attempt ${attempt + 1} failed, retrying in ${delay}ms...`, {
          error: error.message,
          code: error.code
        });

        connectionHealth.consecutiveFailures++;

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

// Check if database is ready and responsive
export const checkDbHealth = async (): Promise<{ healthy: boolean; latencyMs: number; error?: string }> => {
  const startTime = Date.now();

  try {
    if (!pool || !dbReady) {
      return { healthy: false, latencyMs: 0, error: 'Pool not initialized' };
    }

    await pool.query("SELECT 1");
    const latencyMs = Date.now() - startTime;

    return { healthy: true, latencyMs };
  } catch (err: any) {
    return {
      healthy: false,
      latencyMs: Date.now() - startTime,
      error: err.message
    };
  }
};

export const isDbReady = () => dbReady;

export default {
  initializeDatabase,
  getPool,
  query,
  queryNoRetry,
  isDbReady,
  checkDbHealth,
  getConnectionHealth,
  forceReconnect,
  warmupConnection,
};
