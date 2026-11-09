import { runMigrations } from "../../../apps/api/src/migrate.ts";
import { E2E_DATABASE_URL } from "./urls.ts";

export default async function globalSetup(): Promise<void> {
  await runMigrations(E2E_DATABASE_URL);
}
