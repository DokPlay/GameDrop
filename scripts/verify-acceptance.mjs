import { closePool, getPool } from "../server/db/pool.mjs";
import { runAcceptance } from "./acceptance-lib.mjs";

const pool = getPool();
try { process.stdout.write(`${JSON.stringify(await runAcceptance({ pool }), null, 2)}\n`); } finally { await closePool(); }
