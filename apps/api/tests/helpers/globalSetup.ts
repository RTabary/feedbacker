import { runMigrations } from "../../src/migrate.ts";

export default async function setup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is required");
  await runMigrations(url);
}
