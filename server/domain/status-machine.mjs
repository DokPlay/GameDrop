const allowedTransitions = new Map([
  ["created", new Set(["paid", "payment_failed"])],
  ["paid", new Set(["delivering"])],
  ["delivering", new Set(["delivered", "out_of_stock", "delivery_failed"])],
  ["out_of_stock", new Set(["delivering"])],
  ["delivery_failed", new Set(["delivering"])],
  ["payment_failed", new Set(["paid"])],
  ["delivered", new Set()],
]);

export function transition(current, requested) {
  if (current === requested || current === "delivered") {
    return current;
  }
  if (!allowedTransitions.get(current)?.has(requested)) {
    throw new Error(`Illegal order transition: ${current} -> ${requested}`);
  }
  return requested;
}
