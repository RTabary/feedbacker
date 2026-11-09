import { AxeBuilder } from "@axe-core/playwright";
import { expect, test as base, type FrameLocator, type Page } from "@playwright/test";
import pg from "pg";
import { E2E_DATABASE_URL, PRODUCT_URL } from "./urls.ts";

const pool = new pg.Pool({ connectionString: E2E_DATABASE_URL, max: 1 });

export const test = base.extend<{ cleanDatabase: undefined }>({
  cleanDatabase: [
    // eslint-disable-next-line no-empty-pattern -- Playwright impose la déstructuration du premier argument.
    async ({}, use) => {
      await pool.query("TRUNCATE feedback");
      await use(undefined);
    },
    { auto: true },
  ],
});

export const toolPath = (productUrl: string): string => `/?url=${encodeURIComponent(productUrl)}`;

export const productFrame = (page: Page): FrameLocator => page.frameLocator('iframe[title="Produit à évaluer"]');

export const openProduct = async (page: Page, productPath = "/"): Promise<FrameLocator> => {
  await page.goto(toolPath(`${PRODUCT_URL}${productPath}`));
  return productFrame(page);
};

export const expectNoAccessibilityViolations = async (page: Page): Promise<void> => {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map(
      (violation) => `${violation.id}: ${violation.help} -> ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
    ),
  ).toEqual([]);
};

/** Le message d'absence de réponse apparaît après 10 s ; marge pour le chargement de la page. */
export const UNRESPONSIVE_TIMEOUT_MS = 15_000;

export { expect };
