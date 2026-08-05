import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined;
}

function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
  });
}

export const pool = globalThis.pgPool ?? createPool();

if (process.env.NODE_ENV !== 'production') {
  globalThis.pgPool = pool;
}