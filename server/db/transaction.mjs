import { getPool } from "./pool.mjs";

export async function withTransaction(operation, options = {}) {
  const pool = options.pool ?? getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    if (options.isolationLevel) {
      const supported = new Set(["READ COMMITTED", "REPEATABLE READ", "SERIALIZABLE"]);
      if (!supported.has(options.isolationLevel)) {
        throw new Error(`Unsupported isolation level: ${options.isolationLevel}`);
      }
      await client.query(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`);
    }
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
