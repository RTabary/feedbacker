import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { buildApp, type AppOptions } from "../../src/app.ts";

export const FIXED_NOW = new Date("2026-11-04T10:00:00.000Z");
export const ALLOWED_ORIGIN = "https://app.example.com";
export const OTHER_ALLOWED_ORIGIN = "https://rec.example.com";

const testDatabaseUrl = (): string => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is required");
  return url;
};

export const createPool = (): pg.Pool => new pg.Pool({ connectionString: testDatabaseUrl() });

export const truncateFeedback = async (pool: pg.Pool): Promise<void> => {
  await pool.query("TRUNCATE feedback");
};

export const createStaticRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "feedbacker-static-"));
  writeFileSync(join(root, "index.html"), "<!doctype html><title>test</title>");
  writeFileSync(join(root, "connector.js"), "// test connector");
  return root;
};

export const buildTestApp = (pool: pg.Pool, overrides: Partial<AppOptions> = {}) =>
  buildApp({
    pool,
    allowedOrigins: [ALLOWED_ORIGIN, OTHER_ALLOWED_ORIGIN],
    now: () => FIXED_NOW,
    staticRoot: createStaticRoot(),
    logger: false,
    ...overrides,
  });

/** Pool dont toutes les requêtes échouent : simule une base indisponible. */
export const createFailingPool = (): pg.Pool =>
  ({
    query: async () => {
      throw new Error("connect ECONNREFUSED secret-host:5432");
    },
    on: () => undefined,
  }) as unknown as pg.Pool;
