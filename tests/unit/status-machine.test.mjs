import { expect, test } from "vitest";
import { transition } from "../../server/domain/status-machine.mjs";

test.each([
  ["created", "paid"],
  ["created", "payment_failed"],
  ["paid", "delivering"],
  ["delivering", "delivered"],
  ["delivering", "out_of_stock"],
  ["delivering", "delivery_failed"],
  ["out_of_stock", "delivering"],
  ["delivery_failed", "delivering"],
])("allows %s -> %s", (from, to) => {
  expect(transition(from, to)).toBe(to);
});

test("keeps delivered final", () => {
  expect(transition("delivered", "delivering")).toBe("delivered");
});

test("rejects a transition that would skip payment", () => {
  expect(() => transition("created", "delivered")).toThrowError(/Illegal order transition/);
});
