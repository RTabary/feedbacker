import { Writable } from "node:stream";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import type pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registerFeedbackRoutes } from "../../src/feedback/routes.ts";
import { validAnchor, validRequest } from "../helpers/feedbackFactory.ts";
import { ALLOWED_ORIGIN, FIXED_NOW, buildTestApp, createPool, createStaticRoot, truncateFeedback } from "../helpers/testApp.ts";

describe("feedback persistence", () => {
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

  const list = async () =>
    (await app.inject({ method: "GET", url: "/api/feedback", query: { origin: ALLOWED_ORIGIN } })).json().items;

  it("reads back exactly what was confirmed: accents, emojis and JSON (SC-003)", async () => {
    const request = validRequest({
      body: "Été : \"guillemets\", <b>balise</b>, 👍🏽 et\nretour à la ligne",
      authorName: "Zoé Ñ 🧪",
      anchor: {
        selector: '[data-testid="sauvegarde \\"é\\""] > span:nth-of-type(2)',
        tagName: "span",
        textExcerpt: "Résumé 👍",
        rect: { x: -10.5, y: 2000.25, width: 0, height: 19.5 },
      },
    });
    const created = await app.inject({ method: "POST", url: "/api/feedback", payload: request });
    expect(created.statusCode).toBe(201);
    expect(await list()).toEqual([created.json()]);
  });

  it("keeps two feedback items on the same element separate", async () => {
    await app.inject({ method: "POST", url: "/api/feedback", payload: validRequest({ body: "Premier", anchor: validAnchor }) });
    await app.inject({ method: "POST", url: "/api/feedback", payload: validRequest({ body: "Second", anchor: validAnchor }) });
    expect((await list()).map((item: { body: string }) => item.body).sort()).toEqual(["Premier", "Second"]);
  });

  it("never writes the feedback text or the author name to the logs (R13)", async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(String(chunk));
        callback();
      },
    });
    const loggedApp = Fastify({ logger: { level: "trace", stream } });
    registerFeedbackRoutes(loggedApp, {
      pool,
      allowedOrigins: [ALLOWED_ORIGIN],
      now: () => FIXED_NOW,
      staticRoot: createStaticRoot(),
    });
    const response = await loggedApp.inject({
      method: "POST",
      url: "/api/feedback",
      payload: validRequest({ body: "texte-confidentiel", authorName: "nom-confidentiel" }),
    });
    await loggedApp.close();
    expect(response.statusCode).toBe(201);
    expect(lines.length).toBeGreaterThan(0);
    const logs = lines.join("\n");
    expect(logs).not.toContain("texte-confidentiel");
    expect(logs).not.toContain("nom-confidentiel");
  });
});
