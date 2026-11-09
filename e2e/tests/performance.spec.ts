import { PRODUCT_URL } from "./helpers/urls.ts";
import { expect, openProduct, test } from "./helpers/tool.ts";

const SAMPLES = 20;

const percentile95 = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
};

// Mesures locales, indicatives : les confirmer sur l'environnement cible.
test.describe("performance", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "measured on a single engine");

  test("displaying the product in the tool costs less than 3 s more than opening it directly (SC-004)", async ({ page }) => {
    const heading = "Produit de démonstration";
    const direct: number[] = [];
    const inTool: number[] = [];
    for (let index = 0; index < SAMPLES; index += 1) {
      const directStart = performance.now();
      await page.goto(`${PRODUCT_URL}/`);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      direct.push(performance.now() - directStart);

      const toolStart = performance.now();
      const product = await openProduct(page);
      await expect(product.getByRole("heading", { name: heading })).toBeVisible();
      inTool.push(performance.now() - toolStart);
    }
    expect(percentile95(inTool) - percentile95(direct)).toBeLessThan(3000);
  });

  test("saving a feedback is confirmed in less than 2 s (SC-005)", async ({ page }) => {
    test.setTimeout(120_000);
    const product = await openProduct(page);
    const annotate = page.getByRole("button", { name: "Surligner un élément" });
    await expect(annotate).toBeEnabled();
    await page.getByRole("button", { name: "Définir mon nom" }).click();
    await page.getByRole("textbox", { name: "Votre nom" }).fill("Camille");
    await page.getByRole("button", { name: "Continuer" }).click();

    const durations: number[] = [];
    for (let index = 0; index < SAMPLES; index += 1) {
      await annotate.click();
      await product.getByRole("heading", { name: "Commande" }).click();
      await page.getByRole("textbox", { name: "Votre retour" }).fill(`Retour ${index}`);
      const start = performance.now();
      await page.getByRole("button", { name: "Enregistrer le retour" }).click();
      await expect(page.getByRole("list", { name: "Retours sur ce produit" }).getByRole("listitem")).toHaveCount(index + 1);
      durations.push(performance.now() - start);
    }
    expect(percentile95(durations)).toBeLessThan(2000);
  });
});
