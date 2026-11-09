import { ApiError, ListFeedbackResponse } from "@feedbacker/contracts";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedFeedback, validAnchor, validDisplayContext } from "../helpers/feedbackFactory.ts";
import { ALLOWED_ORIGIN, OTHER_ALLOWED_ORIGIN, buildTestApp, createFailingPool, createPool, truncateFeedback } from "../helpers/testApp.ts";

describe("GET /api/feedback", () => {
  let pool: pg.Pool;
  let app: FastifyInstance;

  beforeAll(() => {
    pool = createPool();
    app = buildTestApp(pool);
  });
  beforeEach(() => truncateFeedback(pool));
  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  const list = (origin: string) => app.inject({ method: "GET", url: "/api/feedback", query: { origin } });

  it("returns an empty list for an allowed site without feedback", async () => {
    const response = await list(ALLOWED_ORIGIN);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [] });
  });

  it("returns the complete feedback of the site, matching the contract", async () => {
    const id = await seedFeedback(pool);
    const response = await list(ALLOWED_ORIGIN);
    expect(response.statusCode).toBe(200);
    expect(ListFeedbackResponse.parse(response.json()).items).toEqual([
      {
        id,
        productOrigin: ALLOWED_ORIGIN,
        pagePath: "/orders",
        body: "Retour",
        authorName: "Camille",
        anchor: validAnchor,
        displayContext: validDisplayContext,
        createdAt: "2026-11-04T09:00:00.000Z",
      },
    ]);
  });

  it("sorts from the most recent to the oldest", async () => {
    const oldest = await seedFeedback(pool, { createdAt: "2026-11-01T00:00:00.000Z" });
    const newest = await seedFeedback(pool, { createdAt: "2026-11-03T00:00:00.000Z" });
    const middle = await seedFeedback(pool, { createdAt: "2026-11-02T00:00:00.000Z" });
    const { items } = ListFeedbackResponse.parse((await list(ALLOWED_ORIGIN)).json());
    expect(items.map((item) => item.id)).toEqual([newest, middle, oldest]);
  });

  it("breaks ties on createdAt with the id, in descending order", async () => {
    const low = "00000000-0000-4000-8000-000000000001";
    const high = "00000000-0000-4000-8000-000000000002";
    await seedFeedback(pool, { id: low });
    await seedFeedback(pool, { id: high });
    const { items } = ListFeedbackResponse.parse((await list(ALLOWED_ORIGIN)).json());
    expect(items.map((item) => item.id)).toEqual([high, low]);
  });

  it("only returns the feedback of the requested site", async () => {
    await seedFeedback(pool, { productOrigin: OTHER_ALLOWED_ORIGIN });
    const response = await list(ALLOWED_ORIGIN);
    expect(response.json()).toEqual({ items: [] });
  });

  it("requires no authentication (FR-019)", async () => {
    const response = await app.inject({ method: "GET", url: "/api/feedback", query: { origin: ALLOWED_ORIGIN }, headers: {} });
    expect(response.statusCode).toBe(200);
  });

  it("answers 400 when origin is missing", async () => {
    const response = await app.inject({ method: "GET", url: "/api/feedback" });
    expect(response.statusCode).toBe(400);
    expect(ApiError.parse(response.json()).code).toBe("VALIDATION_ERROR");
  });

  it.each(["not a url", "https://app.example.com/path", "HTTPS://APP.EXAMPLE.COM", "ftp://app.example.com", "javascript:alert(1)"])(
    "answers 400 for the invalid origin %s",
    async (origin) => {
      const response = await list(origin);
      expect(response.statusCode).toBe(400);
      expect(ApiError.parse(response.json()).code).toBe("VALIDATION_ERROR");
    },
  );

  it("answers 403 for a site outside the list (FR-003a)", async () => {
    const response = await list("https://evil.example.com");
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ code: "ORIGIN_NOT_ALLOWED" });
  });

  it("answers 500 without detail when the database is unavailable", async () => {
    const failingApp = buildTestApp(createFailingPool());
    const response = await failingApp.inject({ method: "GET", url: "/api/feedback", query: { origin: ALLOWED_ORIGIN } });
    await failingApp.close();
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ code: "INTERNAL_ERROR" });
  });
});
