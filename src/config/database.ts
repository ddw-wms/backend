// File Path = warehouse-backend/src/config/database.ts
import { Pool } from 'pg';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

let pool: Pool | null = null;
let reconnecting = false;
let dbReady = false;

export const initializeDatabase = async (): Promise<Pool> => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL not set.");
    process.exit(1);
  }

  if (pool && dbReady) return pool;

  console.log("🔌 Initializing database pool...");

  const
    newPool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },

      // MOST IMPORTANT for Supabase:
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,

      max: 3,   //if  query very slow (seconds/minutes) then we can increase max: 4 or 5
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 7000,


      statement_timeout: 0,
      query_timeout: 0,
    });

  // test connection before assigning
  try {
    const test = await newPool.query("SELECT NOW()");
    console.log("✅ Database Connected Successfully at:", test.rows[0].now);

    pool = newPool;
    dbReady = true;

    newPool.on("error", handlePoolError);

    return pool;
  } catch (err) {
    console.error("❌ Database connection failed:", (err as Error).message);
    dbReady = false;

    setTimeout(() => initializeDatabase().catch(console.error), 5000);

    throw err;
  }
};

async function handlePoolError(err: Error) {
  console.error("⚠️ Database pool error:", err.message);

  if (reconnecting) return;
  reconnecting = true;
  dbReady = false;

  console.log("🔁 Attempting to reconnect in 5s...");

  try {
    await pool?.end();
  } catch { }

  pool = null;

  setTimeout(async () => {
    try {
      await initializeDatabase();
      console.log("✅ Database reconnected.");
    } catch (e) {
      console.error("❌ Reconnection failed:", (e as Error).message);
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

export const query = async (text: string, params?: any[]) => {
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
