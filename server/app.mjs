import { getPool } from "./db/pool.mjs";
import { FulfillmentService } from "./domain/fulfillment-service.mjs";
import { OrderService } from "./domain/order-service.mjs";
import { PaymentService } from "./domain/payment-service.mjs";
import { ProductService } from "./domain/product-service.mjs";
import { RecoveryService } from "./domain/recovery-service.mjs";
import { SupplierService } from "./domain/supplier-service.mjs";

export function createApplication(options = {}) {
  const pool = options.pool ?? getPool();
  const supplierService = new SupplierService({ pool });
  const fulfillmentService = new FulfillmentService({ pool, supplierService });
  const paymentService = new PaymentService({ pool, fulfillmentService });
  const orderService = new OrderService({ pool, paymentService });
  const recoveryService = new RecoveryService({ pool, fulfillmentService });
  const productService = new ProductService({ pool });

  return {
    pool,
    supplierService,
    fulfillmentService,
    paymentService,
    orderService,
    recoveryService,
    productService,
    adminToken: options.adminToken ?? process.env.ADMIN_TOKEN,
  };
}
