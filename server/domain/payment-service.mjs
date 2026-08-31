import { randomUUID } from "node:crypto";
import { PaymentRepository } from "../db/payment-repository.mjs";
import { withTransaction } from "../db/transaction.mjs";
import { DomainError } from "./errors.mjs";
import { transition } from "./status-machine.mjs";

function validateEvent(payload) {
  const required = ["event_id", "order_id", "status", "amount", "currency", "created_at"];
  if (!payload || required.some((field) => payload[field] === undefined)) {
    throw new DomainError("INVALID_PAYMENT_EVENT", "Payment event fields are incomplete");
  }
  if (!new Set(["paid", "failed"]).has(payload.status)) {
    throw new DomainError("INVALID_PAYMENT_STATUS", "Payment status must be paid or failed");
  }
  if (!Number.isInteger(payload.amount) || payload.amount < 0 || payload.currency !== "RUB") {
    throw new DomainError("INVALID_PAYMENT_AMOUNT", "Payment amount must be integer RUB minor units");
  }
  if (Number.isNaN(Date.parse(payload.created_at))) {
    throw new DomainError("INVALID_PAYMENT_DATE", "created_at must be an ISO date");
  }
}

export class PaymentService {
  constructor({ pool, fulfillmentService }) {
    this.pool = pool;
    this.fulfillmentService = fulfillmentService;
  }

  async acceptPaymentEvent(payload) {
    validateEvent(payload);
    const inserted = await withTransaction(async (client) => {
      const repository = new PaymentRepository(client);
      return repository.insertEvent({
        id: randomUUID(),
        eventId: payload.event_id,
        orderId: payload.order_id,
        status: payload.status,
        payload,
      });
    }, { pool: this.pool });

    if (!inserted) {
      const repository = new PaymentRepository(this.pool);
      const stored = await repository.findByEventId(payload.event_id);
      const order = stored ? await repository.findOrder(stored.external_order_id) : null;
      return {
        accepted: true,
        duplicate: true,
        pending: stored?.processed_at == null,
        status: order?.status ?? null,
      };
    }

    const result = await this.#processStoredEvent(inserted.event_id);
    return { accepted: true, duplicate: false, ...result };
  }

  async processPendingPayments(orderId) {
    const repository = new PaymentRepository(this.pool);
    const events = await repository.listUnprocessed(orderId);
    let result = null;
    for (const event of events) {
      result = await this.#processStoredEvent(event.event_id);
    }
    return result;
  }

  async #processStoredEvent(eventId) {
    const processing = await withTransaction(async (client) => {
      const repository = new PaymentRepository(client);
      const event = await repository.findByEventId(eventId, { forUpdate: true });
      if (!event) {
        throw new DomainError("PAYMENT_EVENT_NOT_FOUND", "Payment event does not exist", {
          httpStatus: 404,
        });
      }
      if (event.processed_at) {
        const current = await repository.findOrder(event.external_order_id);
        return { pending: false, status: current?.status ?? null, fulfill: false };
      }

      let order = await repository.findOrder(event.external_order_id, { forUpdate: true });
      if (!order) {
        await repository.enqueuePending({
          pendingId: randomUUID(),
          paymentEventId: event.id,
          orderId: event.external_order_id,
        });
        return { pending: true, status: null, fulfill: false };
      }

      if (event.event_type === "paid" && event.payload.amount !== order.total_minor) {
        throw new DomainError("PAYMENT_AMOUNT_MISMATCH", "Paid amount does not match order total", {
          httpStatus: 409,
        });
      }

      let fulfill = false;
      if (event.event_type === "paid") {
        if (new Set(["created", "payment_failed"]).has(order.status)) {
          order = await repository.setOrderStatus(order.id, transition(order.status, "paid"));
        }
        fulfill = order.status === "paid";
      } else if (order.status === "created") {
        order = await repository.setOrderStatus(order.id, transition(order.status, "payment_failed"));
      }

      await repository.markProcessed(event.id);
      return { pending: false, status: order.status, orderId: order.id, fulfill };
    }, { pool: this.pool });

    if (processing.fulfill) {
      const order = await this.fulfillmentService.fulfillPaidOrder(processing.orderId);
      return { pending: false, status: order.status };
    }
    return { pending: processing.pending, status: processing.status };
  }
}
