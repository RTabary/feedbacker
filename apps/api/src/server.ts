import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";

const config = loadConfig(process.env);
const pool = new pg.Pool({ connectionString: config.databaseUrl, connectionTimeoutMillis: 5000 });
const staticRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "web", "dist");

const app = buildApp({
  pool,
  allowedOrigins: config.allowedOrigins,
  now: () => new Date(),
  staticRoot,
});

await app.listen({ port: config.port, host: "0.0.0.0" });
