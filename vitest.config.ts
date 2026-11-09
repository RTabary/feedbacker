import { defineConfig } from "vitest/config";

// globalSetup s'exécute dans ce processus : la variable doit y être définie, pas seulement dans les workers.
process.env.TEST_DATABASE_URL ??= "postgres://feedbacker:feedbacker@localhost:54329/feedbacker_test";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "contracts",
          root: "packages/contracts",
          environment: "node",
          include: ["tests/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "api",
          root: "apps/api",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          // Une seule base de test partagée : les fichiers ne doivent pas s'entrelacer.
          fileParallelism: false,
          globalSetup: ["tests/helpers/globalSetup.ts"],
        },
      },
      {
        test: {
          name: "connector",
          root: "packages/connector",
          environment: "jsdom",
          include: ["tests/**/*.test.ts"],
        },
      },
      {
        oxc: { jsx: { runtime: "automatic" } },
        test: {
          name: "web",
          root: "apps/web",
          environment: "jsdom",
          include: ["tests/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
