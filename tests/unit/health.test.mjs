import { expect, test } from "vitest";
import { health } from "../../server/health.mjs";

test("reports the GameDrop service as healthy", () => {
  expect(health()).toEqual({ status: "ok", service: "gamedrop" });
});

