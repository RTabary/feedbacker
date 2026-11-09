import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";

const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export const runMigrations = async (databaseUrl: string): Promise<void> => {
  await runner({
    databaseUrl,
    dir: migrationsDirectory,
    migrationsTable: "pgmigrations",
    direction: "up",
    log: () => undefined,
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Invalid configuration: DATABASE_URL is required");
  await runMigrations(databaseUrl);
}
