export class PaymentRepository {
  constructor(queryable) {
    this.queryable = queryable;
  }

  async insertEvent(event) {
    const { rows } = await this.queryable.query(
      `INSERT INTO payment_events (
         id, event_id, external_order_id, event_type, payload
       ) VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING *`,
      [event.id, event.eventId, event.orderId, event.status, JSON.stringify(event.payload)],
    );
    return rows[0] ?? null;
  }

  async findByEventId(eventId, options = {}) {
    const lockClause = options.forUpdate ? " FOR UPDATE" : "";
    const { rows } = await this.queryable.query(
      `SELECT * FROM payment_events WHERE event_id = $1${lockClause}`,
      [eventId],
    );
    return rows[0] ?? null;
  }

  async findOrder(orderId, options = {}) {
    const lockClause = options.forUpdate ? " FOR UPDATE" : "";
    const { rows } = await this.queryable.query(
      `SELECT * FROM orders WHERE id = $1${lockClause}`,
      [orderId],
    );
    return rows[0] ?? null;
  }

  async enqueuePending(event) {
    await this.queryable.query(
      `INSERT INTO pending_payment_events (
         id, payment_event_id, external_order_id
       ) VALUES ($1, $2, $3)
       ON CONFLICT (payment_event_id) DO NOTHING`,
      [event.pendingId, event.paymentEventId, event.orderId],
    );
  }

  async listUnprocessed(orderId) {
    const { rows } = await this.queryable.query(
      `SELECT event.*
       FROM payment_events AS event
       WHERE event.external_order_id = $1
         AND event.processed_at IS NULL
       ORDER BY event.received_at, event.id`,
      [orderId],
    );
    return rows;
  }

  async setOrderStatus(orderId, status) {
    const timestamps = status === "paid" ? ", paid_at = COALESCE(paid_at, now())" : "";
    const { rows } = await this.queryable.query(
      `UPDATE orders
       SET status = $2, updated_at = now()${timestamps}
       WHERE id = $1
       RETURNING *`,
      [orderId, status],
    );
    return rows[0];
  }

  async markProcessed(eventId) {
    await this.queryable.query(
      `UPDATE payment_events
       SET processed_at = COALESCE(processed_at, now()), processing_error = NULL
       WHERE id = $1`,
      [eventId],
    );
    await this.queryable.query(
      "DELETE FROM pending_payment_events WHERE payment_event_id = $1",
      [eventId],
    );
  }

  async countEvents(eventId) {
    const { rows } = await this.queryable.query(
      "SELECT count(*)::integer AS count FROM payment_events WHERE event_id = $1",
      [eventId],
    );
    return rows[0].count;
  }

  async countPending(orderId) {
    const { rows } = await this.queryable.query(
      `SELECT count(*)::integer AS count
       FROM pending_payment_events
       WHERE external_order_id = $1`,
      [orderId],
    );
    return rows[0].count;
  }
}
