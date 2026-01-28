// File Path = warehouse-backend/src/config/database.ts
import { Pool, PoolClient } from 'pg';
import dns from 'dns';
import { lookup } from 'dns/promises';
import logger from '../utils/logger';

// CRITICAL: Force IPv4 for Supabase Session Pooler
// Render uses IPv6 by default, but Supabase pooler only supports IPv4
dns.setDefaultResultOrder('ipv4first');

// CRITICAL: Allow self-signed certificates for Supabase
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Also set environment variable as backup
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS
  ? `${process.env.NODE_OPTIONS} --dns-result-order=ipv4first`
  : '--dns-result-order=ipv4first';

// CRITICAL: Disable connection keep-alive nagle algorithm for faster handshakes
process.env.UV_TCP_NODELAY = '1';

let pool: Pool | null = null;
let reconnecting = false;
let dbReady = false;
let lastSuccessfulQuery: Date | null = null;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10; // Increased for cross-region connections
const RECONNECT_DELAY_BASE = 1500; // Start with 1.5 seconds

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

// Track if we've tried the direct connection
let triedDirectConnection = false;

export const initializeDatabase = async (retryCount = 0): Promise<Pool> => {
  // CRITICAL: Support both pooler and direct connection URLs
  // Use DIRECT_DATABASE_URL as fallback for network issues
  let dbUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_DATABASE_URL;

  // After 3 failed attempts, try direct connection if available
  if (retryCount >= 3 && directUrl && !triedDirectConnection) {
    console.log(`[DB] ⚠️ Pooler connection failing. Trying DIRECT_DATABASE_URL...`);
    dbUrl = directUrl;
    triedDirectConnection = true;
  }

  if (!dbUrl) {
    logger.error("DATABASE_URL not set");
    throw new Error("DATABASE_URL environment variable is not set");
  }

  if (pool && dbReady) return pool;

  // CRITICAL: Add sslmode and pgbouncer params if not present (required for Supabase)
  const urlObj = new URL(dbUrl);
  const searchParams = urlObj.searchParams;

  // Add sslmode=require if not present
  if (!searchParams.has('sslmode')) {
    searchParams.set('sslmode', 'require');
  }

  // Detect if using Supabase Session Pooler
  const isPooler = dbUrl.includes('pooler.supabase.com');

  // Add pgbouncer=true for pooler connections
  if (isPooler && !searchParams.has('pgbouncer')) {
    searchParams.set('pgbouncer', 'true');
  }

  // CRITICAL: For cross-region connections, use Transaction Pooler (port 6543) instead of Session Pooler (port 5432)
  // Transaction mode has better connection handling and lower latency
  if (isPooler && urlObj.port === '5432') {
    console.log(`[DB] ⚠️ Switching from Session Pooler (5432) to Transaction Pooler (6543) for better reliability`);
    urlObj.port = '6543';
  }

  // Reconstruct URL with params
  dbUrl = urlObj.toString();

  // Log connection attempt with masked URL for debugging
  const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
  console.log(`[DB] Connecting to: ${maskedUrl}`);
  console.log(`[DB] Attempt ${retryCount + 1}/${MAX_RECONNECT_ATTEMPTS + 1}`);

  // DNS resolution test (for debugging)
  const hostname = urlObj.hostname;
  try {
    console.log(`[DB] Resolving hostname: ${hostname}`);
    const addresses = await lookup(hostname, { family: 4 });
    console.log(`[DB] Resolved to IPv4: ${addresses.address}`);
  } catch (dnsErr: any) {
    console.error(`[DB] ❌ DNS lookup failed:`, dnsErr.message);
    // Continue anyway - pg library will try to resolve
  }

  // Detect if using PgBouncer mode
  const isPgBouncer = dbUrl.includes('pgbouncer=true') ||
    dbUrl.includes(':6543') ||
    dbUrl.includes('pooler.supabase.com');
  console.log(`[DB] Using PgBouncer/Transaction Pooler mode: ${isPgBouncer}`);

  // Detect if running on Render (production) - needs longer timeouts for cross-region
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  // CRITICAL: Use shorter initial connection timeout but more aggressive retries
  // Long timeouts cause Render to think the service is hanging
  const connectionTimeout = 30000; // 30s - balanced for cross-region without blocking too long
  const acquireTimeout = 20000; // Timeout for acquiring a connection from pool
  console.log(`[DB] Connection timeout: ${connectionTimeout}ms (production: ${isProduction})`);

  const newPool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },

    // CRITICAL: TCP keepalive settings for cross-region connections
    keepAlive: true,
    keepAliveInitialDelayMillis: 1000, // Send keepalive after 1s of idle (faster detection)

    // CRITICAL: Pool size optimized for PgBouncer Transaction mode
    // Transaction mode multiplexes connections, so we need fewer client-side connections
    max: isPgBouncer ? 3 : 5, // Reduced - PgBouncer handles pooling
    min: 1,
    idleTimeoutMillis: 60000, // Close idle connections after 60s (save resources)
    connectionTimeoutMillis: connectionTimeout,
    allowExitOnIdle: false,

    // Query timeouts
    query_timeout: 25000, // 25s query timeout
    statement_timeout: 25000,
  });

  // Set application_name for debugging in Supabase
  newPool.on('connect', (client) => {
    client.query("SET application_name = 'wms-backend-render'");
  });

  // Keep-alive ping every 20 seconds to prevent timeout
  // CRITICAL: Use a separate lightweight query to maintain connection
  const keepAliveInterval = setInterval(async () => {
    if (pool && dbReady) {
      try {
        await pool.query('SELECT 1');
      } catch (err) {
        // Ignore - health check will handle reconnection
      }
    }
  }, 20000);

  // Prevent interval from keeping Node.js process alive
  keepAliveInterval.unref();

  // test connection before assigning
  try {
    console.log(`[DB] Testing connection with SELECT NOW()...`);
    const test = await newPool.query("SELECT NOW()");
    console.log(`[DB] ✅ Connected successfully at ${test.rows[0].now}`);
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
    console.error(`[DB] ❌ Connection failed:`, err.message);
    console.error(`[DB] Error code:`, err.code);
    console.error(`[DB] Full error:`, JSON.stringify({
      message: err.message,
      code: err.code,
      errno: err.errno,
      syscall: err.syscall,
      hostname: err.hostname
    }));

    logger.error("Database connection failed", err as Error, { attempt: retryCount + 1 });
    dbReady = false;
    connectionHealth = {
      isHealthy: false,
      lastCheck: new Date(),
      consecutiveFailures: connectionHealth.consecutiveFailures + 1,
      lastError: err.message,
    };

    // Close the failed pool to release resources
    try {
      await newPool.end();
    } catch { }

    // CRITICAL: Shorter exponential backoff with jitter for cross-region connections
    // Faster retries with randomization to avoid thundering herd
    if (retryCount < MAX_RECONNECT_ATTEMPTS) {
      const baseDelay = RECONNECT_DELAY_BASE * Math.pow(1.5, retryCount); // 1.5x growth instead of 2x
      const jitter = Math.random() * 1000; // Add up to 1s random jitter
      const delay = Math.min(baseDelay + jitter, 15000); // Cap at 15 seconds
      console.log(`[DB] Retrying in ${Math.round(delay)}ms...`);
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

  // Check connection health every 15 seconds
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

      // If 2 consecutive failures, trigger reconnection
      if (connectionHealth.consecutiveFailures >= 2) {
        connectionHealth.isHealthy = false;
        handlePoolError(err);
      }
    }
  }, 15000);
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
