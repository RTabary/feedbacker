import { ApiError, Feedback } from "@feedbacker/contracts";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { validAnchor, validDisplayContext, validRequest } from "../helpers/feedbackFactory.ts";
import { ALLOWED_ORIGIN, FIXED_NOW, buildTestApp, createFailingPool, createPool, truncateFeedback } from "../helpers/testApp.ts";

describe("POST /api/feedback", () => {
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

  const post = (payload: unknown) => app.inject({ method: "POST", url: "/api/feedback", payload: payload as object });

  it("creates a feedback, with createdAt set by the server (FR-010)", async () => {
    const request = validRequest({ createdAt: "2000-01-01T00:00:00.000Z" });
    const response = await post(request);
    expect(response.statusCode).toBe(201);
    expect(Feedback.parse(response.json())).toEqual({
      id: request.id,
      productOrigin: ALLOWED_ORIGIN,
      pagePath: "/orders",
      body: "Le libellé est ambigu",
      authorName: "Camille",
      anchor: validAnchor,
      displayContext: validDisplayContext,
      createdAt: FIXED_NOW.toISOString(),
    });
  });

  it("stores the values without leading and trailing whitespace, and returns them", async () => {
    const response = await post(validRequest({ body: "  Bonjour \n", authorName: " Camille " }));
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ body: "Bonjour", authorName: "Camille" });
  });

  it("makes a new attempt with the same id safe: 200, nothing overwritten (R14)", async () => {
    const request = validRequest();
    await post(request);
    const again = await post({ ...request, body: "Autre texte", authorName: "Autre" });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({ id: request.id, body: request.body, authorName: "Camille" });
    const { rows } = await pool.query("SELECT count(*)::int AS count FROM feedback");
    expect(rows[0].count).toBe(1);
  });

  it.each([
    ["id", { id: "not-a-uuid" }],
    ["body", { body: "   " }],
    ["body", { body: "a".repeat(5001) }],
    ["body", { body: "a\u0000b" }],
    ["body", { body: "a\ud83d" }],
    ["authorName", { authorName: "" }],
    ["authorName", { authorName: "a".repeat(101) }],
    ["pagePath", { pagePath: "orders" }],
    ["productOrigin", { productOrigin: "https://app.example.com/path" }],
    ["anchor.selector", { anchor: { ...validAnchor, selector: "" } }],
    ["anchor.tagName", { anchor: { ...validAnchor, tagName: "BUTTON" } }],
    ["anchor.textExcerpt", { anchor: { ...validAnchor, textExcerpt: "a\u0000" } }],
    ["anchor.rect.width", { anchor: { ...validAnchor, rect: { ...validAnchor.rect, width: -1 } } }],
    ["displayContext.viewportWidth", { displayContext: { ...validDisplayContext, viewportWidth: 0 } }],
  ])("answers 400 and names the field %s", async (path, override) => {
    const response = await post(validRequest(override));
    expect(response.statusCode).toBe(400);
    const error = ApiError.parse(response.json());
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.issues?.map((issue) => issue.path)).toContain(path);
  });

  it("answers 400 when a required object is missing", async () => {
    const response = await post({ ...validRequest(), anchor: undefined });
    expect(response.statusCode).toBe(400);
    expect(ApiError.parse(response.json()).issues?.map((issue) => issue.path)).toContain("anchor");
  });

  it("answers 403 for a site outside the list, and stores nothing (FR-003a)", async () => {
    const response = await post(validRequest({ productOrigin: "https://evil.example.com" }));
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ code: "ORIGIN_NOT_ALLOWED" });
    const { rows } = await pool.query("SELECT count(*)::int AS count FROM feedback");
    expect(rows[0].count).toBe(0);
  });

  it("answers 413 over 64 KiB", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/feedback",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify(validRequest({ body: "a".repeat(64 * 1024) })),
    });
    expect(response.statusCode).toBe(413);
    expect(ApiError.parse(response.json()).code).toBe("VALIDATION_ERROR");
  });

  it("answers 500 without detail when the database is unavailable", async () => {
    const failingApp = buildTestApp(createFailingPool());
    const response = await failingApp.inject({ method: "POST", url: "/api/feedback", payload: validRequest() });
    await failingApp.close();
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ code: "INTERNAL_ERROR" });
  });
});
