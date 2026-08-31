import { createHash, randomUUID } from "node:crypto";
import { SupplierRepository } from "../db/supplier-repository.mjs";
import { withTransaction } from "../db/transaction.mjs";
import { DomainError } from "./errors.mjs";

function deterministicCode({ provider, requestId, sku }) {
  const digest = createHash("sha256")
    .update(`${provider}:${requestId}:${sku}`)
    .digest("hex")
    .slice(0, 20)
    .toUpperCase();
  return `GD-${provider}-${digest}`;
}

function publicResponse(row) {
  return {
    status: row.status === "issued" ? "ok" : "error",
    provider: row.provider,
    request_id: row.request_id,
    code: row.response_code,
  };
}

export class SupplierService {
  constructor({ pool }) {
    this.pool = pool;
  }

  async issueFromSupplier(input) {
    if (!new Set(["A", "B"]).has(input?.provider) || !input?.requestId || !input?.sku) {
      throw new DomainError("INVALID_SUPPLIER_REQUEST", "Provider, requestId, and sku are required");
    }

    const result = await withTransaction(async (client) => {
      const repository = new SupplierRepository(client);
      const existing = await repository.findRequest(input.provider, input.requestId);
      if (existing) {
        return { row: existing, replay: true };
      }

      const failed = input.behavior === "fail_5xx";
      const code = failed ? null : deterministicCode(input);
      const row = await repository.insertRequest({
        id: randomUUID(),
        provider: input.provider,
        requestId: input.requestId,
        sku: input.sku,
        orderId: String(input.orderId),
        status: failed ? "failed" : "issued",
        code,
        payload: failed
          ? { status: "error", error: "simulated_5xx" }
          : { status: "ok", request_id: input.requestId, code },
      });
      return { row, replay: false };
    }, { pool: this.pool });

    if (result.row.status === "failed") {
      throw new DomainError("SUPPLIER_5XX", `${input.provider} returned a simulated 5xx`, {
        httpStatus: 503,
      });
    }
    if (!result.replay && input.behavior === "timeout_after_issue") {
      throw new DomainError(
        "SUPPLIER_TIMEOUT",
        `${input.provider} timed out after persisting the issued code`,
        { httpStatus: 504 },
      );
    }
    return publicResponse(result.row);
  }
}
