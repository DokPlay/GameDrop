import { expect, test } from "vitest";
import { nextSlideIndex } from "../../src/ui/carousel.js";
import { formatMoney } from "../../src/ui/currency-switcher.js";

test("carousel state wraps in both directions", () => {
  expect(nextSlideIndex(2, 3)).toBe(0);
  expect(nextSlideIndex(0, 3, -1)).toBe(2);
});

test("money rendering is derived from server minor RUB units", () => {
  expect(formatMoney(129000, "RUB").replaceAll(/\s/g, " ")).toContain("1 290");
  expect(formatMoney(129000, "USD")).toContain("14.19");
});
