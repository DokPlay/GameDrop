import { getConnectionString } from "@netlify/database";
import pg from "pg";

const { Pool } = pg;
let sharedPool;

export function resolveDatabaseUrl(options = {}) {
  const environment = options.environment ?? process.env;
  const databaseUrl = options.databaseUrl ?? environment.DATABASE_URL;
  if (databaseUrl) {
    return databaseUrl;
  }

  const netlifyUrl = (options.getNetlifyUrl ?? getConnectionString)();
  if (!netlifyUrl) {
    throw new Error("PostgreSQL connection string is required");
  }
  return netlifyUrl;
}

export function createPool(overrides = {}) {
  const connectionString = resolveDatabaseUrl({ databaseUrl: overrides.connectionString });

  return new Pool({
    connectionString,
    max: overrides.max ?? 10,
    idleTimeoutMillis: overrides.idleTimeoutMillis ?? 10_000,
    connectionTimeoutMillis: overrides.connectionTimeoutMillis ?? 5_000,
    ssl:
      overrides.ssl
      ?? (process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined),
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
