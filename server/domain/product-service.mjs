import { ProductRepository } from "../db/product-repository.mjs";

export class ProductService {
  constructor({ pool }) {
    this.pool = pool;
  }

  async listProducts() {
    const repository = new ProductRepository(this.pool);
    const products = await repository.listActive();
    return products.map((product) => ({
      sku: product.sku,
      name: product.name,
      description: product.description,
      price: product.price_minor,
      currency: product.currency,
      fulfillmentMode: product.fulfillment_mode,
      imageUrl: product.image_url,
      metadata: product.metadata,
    }));
  }
}
