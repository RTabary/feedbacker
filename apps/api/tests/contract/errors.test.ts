import type { FastifyInstance } from "fastify";
import { ApiError } from "@feedbacker/contracts";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, createPool } from "../helpers/testApp.ts";

describe("API errors", () => {
  let pool: pg.Pool;
  let app: FastifyInstance;

  beforeAll(async () => {
    pool = createPool();
    app = buildTestApp(pool);
    app.get("/api/__boom", async () => {
      throw new Error("boom: secret detail");
    });
    app.post("/api/__echo", async (request) => request.body);
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it("maps an unexpected error to a 500 INTERNAL_ERROR without technical detail", async () => {
    const response = await app.inject({ method: "GET", url: "/api/__boom" });
    expect(response.statusCode).toBe(500);
    expect(ApiError.parse(response.json())).toEqual({ code: "INTERNAL_ERROR" });
    expect(response.body).not.toContain("secret detail");
  });

  it("maps a body over 64 KiB to a 413 VALIDATION_ERROR", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/__echo",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ body: "a".repeat(64 * 1024) }),
    });
    expect(response.statusCode).toBe(413);
    expect(ApiError.parse(response.json()).code).toBe("VALIDATION_ERROR");
  });

  it("survives the loss of an idle database connection instead of crashing the process", async () => {
    // Sans écouteur, un événement `error` du pool lève une exception : un redémarrage de la base tuerait l'API.
    expect(() => pool.emit("error", new Error("terminating connection"))).not.toThrow();
    const response = await app.inject({ method: "GET", url: "/api/__boom" });
    expect(response.statusCode).toBe(500);
  });

  it("maps malformed JSON to a 400 VALIDATION_ERROR", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/__echo",
      headers: { "content-type": "application/json" },
      payload: "{not json",
    });
    expect(response.statusCode).toBe(400);
    expect(ApiError.parse(response.json()).code).toBe("VALIDATION_ERROR");
  });
});
