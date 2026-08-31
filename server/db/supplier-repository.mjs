export class SupplierRepository {
  constructor(queryable) {
    this.queryable = queryable;
  }

  async findRequest(provider, requestId) {
    const { rows } = await this.queryable.query(
      `SELECT * FROM supplier_requests
       WHERE provider = $1 AND request_id = $2`,
      [provider, requestId],
    );
    return rows[0] ?? null;
  }

  async insertRequest(request) {
    const { rows } = await this.queryable.query(
      `INSERT INTO supplier_requests (
         id, provider, request_id, sku, external_order_id,
         status, response_code, response_payload
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (provider, request_id) DO NOTHING
       RETURNING *`,
      [
        request.id,
        request.provider,
        request.requestId,
        request.sku,
        request.orderId,
        request.status,
        request.code,
        JSON.stringify(request.payload),
      ],
    );
    return rows[0] ?? this.findRequest(request.provider, request.requestId);
  }

  async distinctCodesForRequest(provider, requestId) {
    const { rows } = await this.queryable.query(
      `SELECT count(DISTINCT response_code)::integer AS count
       FROM supplier_requests
       WHERE provider = $1 AND request_id = $2`,
      [provider, requestId],
    );
    return rows[0].count;
  }

  async getFulfillment(orderId) {
    const { rows } = await this.queryable.query(
      "SELECT * FROM fulfillment_records WHERE order_id = $1",
      [orderId],
    );
    return rows[0] ?? null;
  }

  async countAttempts(orderId, outcome) {
    const { rows } = await this.queryable.query(
      `SELECT count(*)::integer AS count
       FROM fulfillment_attempts
       WHERE order_id = $1 AND outcome = $2`,
      [orderId, outcome],
    );
    return rows[0].count;
  }

  async countProviderRequests(orderId, provider) {
    const { rows } = await this.queryable.query(
      `SELECT count(*)::integer AS count
       FROM supplier_requests
       WHERE external_order_id = $1 AND provider = $2`,
      [String(orderId), provider],
    );
    return rows[0].count;
  }
}
