export class OrderRepository {
  constructor(queryable) {
    this.queryable = queryable;
  }

  async findById(id, options = {}) {
    const lockClause = options.forUpdate ? " FOR UPDATE" : "";
    const { rows } = await this.queryable.query(
      `SELECT * FROM orders WHERE id = $1${lockClause}`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findByClientRequestId(clientRequestId) {
    const { rows } = await this.queryable.query(
      "SELECT * FROM orders WHERE client_request_id = $1",
      [clientRequestId],
    );
    return rows[0] ?? null;
  }
}
