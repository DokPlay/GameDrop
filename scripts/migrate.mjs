import { closePool } from "../server/db/pool.mjs";
import { migrate } from "../server/db/migrate.mjs";

try {
  await migrate();
  process.stdout.write("Database migrations are up to date.\n");
} finally {
  await closePool();
}
