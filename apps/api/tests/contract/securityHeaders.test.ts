import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALLOWED_ORIGIN, OTHER_ALLOWED_ORIGIN, buildTestApp, createPool } from "../helpers/testApp.ts";

describe("security headers and static resources", () => {
  let pool: pg.Pool;
  let app: FastifyInstance;

  beforeAll(() => {
    pool = createPool();
    app = buildTestApp(pool);
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it("serves the interface with the exact CSP built from the list of sites", async () => {
    const response = await app.inject({ method: "GET", url: "/" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.headers["content-security-policy"]).toBe(
      [
        "default-src 'none'",
        "script-src 'self'",
        "style-src 'self'",
        "connect-src 'self'",
        "img-src 'self'",
        "font-src 'self'",
        `frame-src ${ALLOWED_ORIGIN} ${OTHER_ALLOWED_ORIGIN}`,
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join("; "),
    );
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("keeps the CSP when a query string carries the product address", async () => {
    const response = await app.inject({ method: "GET", url: "/?url=https%3A%2F%2Fapp.example.com%2F" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-security-policy"]).toContain("frame-src");
  });

  it("serves connector.js with a short public cache", async () => {
    const response = await app.inject({ method: "GET", url: "/connector.js" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("javascript");
    expect(response.headers["cache-control"]).toBe("public, max-age=300");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
});
