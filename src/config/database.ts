// File Path = warehouse-backend/src/config/database.ts
import { Pool } from 'pg';
import dns from 'dns';
import logger from '../utils/logger';

dns.setDefaultResultOrder('ipv4first');

let pool: Pool | null = null;
let reconnecting = false;
let dbReady = false;

export const initializeDatabase = async (): Promise<Pool> => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    logger.error("DATABASE_URL not set");
    process.exit(1);
  }

  if (pool && dbReady) return pool;

  logger.info("Initializing database pool...");

  const isPgBouncer = dbUrl.includes('pgbouncer=true') || dbUrl.includes(':6543');

  const
    newPool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },

      // MOST IMPORTANT for Supabase/Remote DB:
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,

      // Pool configuration - OPTIMIZED for Supabase FREE TIER
      max: isPgBouncer ? 3 : 5,   // Fewer connections for PgBouncer/Transaction mode
      min: 0,    // Don't keep any minimum connections (let PgBouncer manage)
      idleTimeoutMillis: 5000,   // Release idle connections very quickly (5 seconds)
      connectionTimeoutMillis: 30000,  // 30 seconds to connect
      allowExitOnIdle: true,  // Release all connections when idle

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

    newPool.on("error", handlePoolError);

    return pool;
  } catch (err) {
    logger.error("Database connection failed", err as Error);
    dbReady = false;

    setTimeout(() => initializeDatabase().catch((e) => logger.error("Reconnection attempt failed", e)), 5000);

    throw err;
  }
};

async function handlePoolError(err: Error) {
  logger.warn("Database pool error", { message: err.message });

  if (reconnecting) return;
  reconnecting = true;
  dbReady = false;

  logger.info("Attempting to reconnect in 5s...");

  try {
    await pool?.end();
  } catch { }

  pool = null;

  setTimeout(async () => {
    try {
      await initializeDatabase();
      logger.info("Database reconnected");
    } catch (e) {
      logger.error("Reconnection failed", e as Error);
    } finally {
      reconnecting = false;
    }
  }, 5000);
}

export const getPool = (): Pool => {
  if (!dbReady || !pool) {
    throw new Error("Database not ready");
  }
  return pool;
};

export const query = async (text: string, params?: any[], retries = 2) => {
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

      // Retry on connection/timeout errors
      if (attempt < retries && (
        error.message?.includes('timeout') ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('connection') ||
        error.code === 'ECONNREFUSED'
      )) {
        console.log(`⚠️ Query attempt ${attempt + 1} failed, retrying in 1s...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
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

export default {
  initializeDatabase,
  getPool,
  query,
  isDbReady,
};
