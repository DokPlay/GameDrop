import { describe, expect, it, vi } from "vitest";
import { resolveDatabaseUrl } from "../../server/db/pool.mjs";

describe("database connection configuration", () => {
  it("falls back to the Netlify Database connection when DATABASE_URL is absent", () => {
    const getNetlifyUrl = vi.fn(() => "postgresql://netlify.example/gamedrop");

    expect(resolveDatabaseUrl({ environment: {}, getNetlifyUrl })).toBe(
      "postgresql://netlify.example/gamedrop",
    );
    expect(getNetlifyUrl).toHaveBeenCalledOnce();
  });

  it("keeps an explicit DATABASE_URL ahead of the platform fallback", () => {
    const getNetlifyUrl = vi.fn(() => "postgresql://netlify.example/gamedrop");

    expect(
      resolveDatabaseUrl({
        databaseUrl: "postgresql://configured.example/gamedrop",
        getNetlifyUrl,
      }),
    ).toBe("postgresql://configured.example/gamedrop");
    expect(getNetlifyUrl).not.toHaveBeenCalled();
  });
});
