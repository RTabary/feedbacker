import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL, PRODUCT_URL, TOOL_URL } from "./tests/helpers/urls.ts";

export default defineConfig({
  testDir: "tests",
  testMatch: /.*\.spec\.ts/,
  outputDir: "test-results",
  // Une seule base partagée, purgée avant chaque test : pas d'exécution concurrente.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  globalSetup: "./tests/helpers/globalSetup.ts",
  use: {
    baseURL: TOOL_URL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    {
      name: "mobile",
      testMatch: /us[23]-.*\.spec\.ts/,
      use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: [
    {
      command: "node ../apps/api/src/server.ts",
      url: "http://localhost:3000/",
      reuseExistingServer: false,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        ALLOWED_PRODUCT_ORIGINS: PRODUCT_URL,
        PORT: "3000",
      },
    },
    {
      command: "node fixtures/product-site/server.ts",
      url: "http://localhost:3001/health",
      reuseExistingServer: false,
    },
  ],
});
