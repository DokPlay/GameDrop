import { DomainError } from "./errors.mjs";

export function normalizePromoCode(code) {
  return typeof code === "string" ? code.trim().toUpperCase() : "";
}

export function calculateDiscount(subtotal, promo) {
  if (!promo) {
    return 0;
  }
  if (promo.discount_type === "percent") {
    return Math.min(subtotal, Math.floor((subtotal * promo.discount_value) / 100));
  }
  return Math.min(subtotal, promo.discount_value);
}

export async function reservePromo(queryable, code) {
  const normalized = normalizePromoCode(code);
  const { rows } = await queryable.query(
    `UPDATE promos
     SET used_count = used_count + 1
     WHERE code = $1
       AND active = true
       AND used_count < max_uses
       AND (starts_at IS NULL OR starts_at <= now())
       AND (ends_at IS NULL OR ends_at > now())
     RETURNING *`,
    [normalized],
  );

  if (!rows[0]) {
    throw new DomainError(
      "PROMO_UNAVAILABLE",
      "Promo code is invalid, inactive, or has reached its use limit",
      { httpStatus: 409 },
    );
  }
  return rows[0];
}
