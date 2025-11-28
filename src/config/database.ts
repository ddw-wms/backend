import { Pool } from 'pg';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first'); // Fix for Render/Supabase IPv6 issues

let pool: Pool | null = null;
let reconnecting = false; // prevent multiple reconnections

export const initializeDatabase = async (): Promise<Pool> => {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('❌ FATAL: DATABASE_URL not set');
    process.exit(1);
  }

  // If already connected and healthy, reuse it
  if (pool) {
    console.log('ℹ️ Database pool already initialized.');
    return pool;
  }

  console.log('🔌 Initializing database pool...');

  pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', async (err) => {
    console.error('⚠️ Unexpected database pool error:', err.message);

    if (!reconnecting) {
      reconnecting = true;
      console.log('🔁 Attempting to reconnect to database in 5s...');
      pool?.end().catch(() => null);
      pool = null;
      setTimeout(async () => {
        try {
          await initializeDatabase();
          console.log('✅ Database reconnected successfully.');
        } catch (e) {
          console.error('❌ Reconnection failed:', (e as Error).message);
        } finally {
          reconnecting = false;
        }
      }, 5000);
    }
  });

  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database Connected Successfully at:', result.rows[0].now);
    return pool;
  } catch (error) {
    console.error('❌ Database Connection Error:', (error as Error).message);
    console.log('🔁 Retrying connection in 5 seconds...');
    setTimeout(() => initializeDatabase().catch(console.error), 5000);
    throw error;
  }
};

export const getPool = (): Pool => {
  if (!pool) throw new Error('Database not initialized');
  return pool;
};

export const query = async (text: string, params?: any[]) => {
  const currentPool = getPool();
  try {
    return await currentPool.query(text, params);
  } catch (err: any) {
    console.error('❌ Query execution error:', err.message);
    throw err;
  }
};

export default {
  initializeDatabase,
  getPool,
  query,
};
