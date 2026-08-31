import pg from "pg";

const { Pool } = pg;
let sharedPool;

export function createPool(overrides = {}) {
  const connectionString = overrides.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  return new Pool({
    connectionString,
    max: overrides.max ?? 10,
    idleTimeoutMillis: overrides.idleTimeoutMillis ?? 10_000,
    connectionTimeoutMillis: overrides.connectionTimeoutMillis ?? 5_000,
    ssl:
      overrides.ssl
      ?? (process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false),
  });
}

export function getPool() {
  sharedPool ??= createPool();
  return sharedPool;
}

export async function closePool() {
  if (sharedPool) {
    await sharedPool.end();
    sharedPool = undefined;
  }
}
