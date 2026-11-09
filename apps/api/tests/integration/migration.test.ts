import { randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPool, truncateFeedback } from "../helpers/testApp.ts";

const insert = (pool: pg.Pool, override: Record<string, unknown> = {}) => {
  const row = {
    id: randomUUID(),
    product_origin: "https://app.example.com",
    page_path: "/",
    body: "ok",
    author_name: "Camille",
    anchor: {},
    display_context: {},
    created_at: new Date("2026-11-04T10:00:00Z"),
    ...override,
  };
  return pool.query(
    `INSERT INTO feedback (id, product_origin, page_path, body, author_name, anchor, display_context, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [row.id, row.product_origin, row.page_path, row.body, row.author_name,
      JSON.stringify(row.anchor), JSON.stringify(row.display_context), row.created_at],
  );
};

describe("feedback table", () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = createPool();
  });
  beforeEach(() => truncateFeedback(pool));
  afterAll(() => pool.end());

  it("accepts a valid row", async () => {
    await expect(insert(pool)).resolves.toBeDefined();
  });

  it.each([
    ["empty body", { body: "" }],
    ["body over 5000 characters", { body: "a".repeat(5001) }],
    ["empty author_name", { author_name: "" }],
    ["author_name over 100 characters", { author_name: "a".repeat(101) }],
    ["page_path without a leading slash", { page_path: "orders" }],
    ["page_path over 2048 characters", { page_path: `/${"a".repeat(2048)}` }],
    ["anchor that is not an object", { anchor: [] }],
    ["display_context that is not an object", { display_context: 1 }],
  ])("refuses %s", async (_label, override) => {
    await expect(insert(pool, override)).rejects.toThrow(/check constraint/);
  });

  it("counts characters like the shared schema: 5000 emojis are accepted", async () => {
    await expect(insert(pool, { body: "👍".repeat(5000) })).resolves.toBeDefined();
  });

  it("has the index covering the list order", async () => {
    const { rows } = await pool.query<{ indexdef: string }>(
      "SELECT indexdef FROM pg_indexes WHERE tablename = 'feedback'",
    );
    expect(rows.map((row) => row.indexdef).join("\n")).toContain("(product_origin, created_at DESC, id DESC)");
  });
});
