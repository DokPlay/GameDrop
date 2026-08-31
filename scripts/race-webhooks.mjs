import { closePool, getPool } from "../server/db/pool.mjs";
import { runDuplicateEvent, runEarlyWebhook, runParallelWebhookRace } from "./acceptance-lib.mjs";

const pool = getPool();
try {
  const report = { parallelWebhooks: await runParallelWebhookRace({ pool }), duplicateEvent: await runDuplicateEvent({ pool }), earlyWebhook: await runEarlyWebhook({ pool }) };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally { await closePool(); }
