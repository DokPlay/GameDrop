import { describe, expect, it } from "vitest";
import { migrationChecksum } from "../../server/db/migrate.mjs";

describe("migration checksum", () => {
  it("treats LF and CRLF migrations as the same immutable migration", () => {
    const expected = "b4e0497804e46e0a0b0b8c31975b062152d551bac49c3c2e80932567b4085dcd";

    expect(migrationChecksum("SELECT 1;\n")).toBe(expected);
    expect(migrationChecksum("SELECT 1;\r\n")).toBe(expected);
  });
});
