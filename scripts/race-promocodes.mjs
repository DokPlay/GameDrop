import { closePool, getPool } from "../server/db/pool.mjs";
import { runPromoRace } from "./acceptance-lib.mjs";

const pool = getPool();
try { process.stdout.write(`${JSON.stringify(await runPromoRace({ pool }), null, 2)}\n`); } finally { await closePool(); }
