import { randomUUID } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import { PRODUCT_URL } from "./helpers/urls.ts";
import { expect, expectNoAccessibilityViolations, openProduct, productFrame, test } from "./helpers/tool.ts";

const seed = async (
  request: APIRequestContext,
  override: { pagePath?: string; body?: string; authorName?: string; selector?: string; tagName?: string; textExcerpt?: string } = {},
): Promise<string> => {
  const id = randomUUID();
  const response = await request.post("/api/feedback", {
    data: {
      id,
      productOrigin: PRODUCT_URL,
      pagePath: override.pagePath ?? "/",
      body: override.body ?? "Retour",
      authorName: override.authorName ?? "Camille",
      anchor: {
        selector: override.selector ?? '[id="counter"]',
        tagName: override.tagName ?? "button",
        textExcerpt: override.textExcerpt ?? "Ajouter au panier",
        rect: { x: 0, y: 0, width: 10, height: 10 },
      },
      displayContext: { viewportWidth: 1280, viewportHeight: 720, scrollX: 0, scrollY: 0 },
    },
  });
  expect(response.status()).toBe(201);
  return id;
};

const seedSecondPage = (request: APIRequestContext, body = "Retour seconde page") =>
  seed(request, {
    pagePath: "/second-page",
    body,
    selector: '[data-testid="second-element"]',
    tagName: "p",
    textExcerpt: "Contenu de la seconde page",
  });

const list = (page: Page) => page.getByRole("list", { name: "Retours sur ce produit" });
const itemFor = (page: Page, body: string) => list(page).getByRole("listitem").filter({ hasText: body });
const markers = (page: Page) => productFrame(page).locator("[data-feedbacker-overlay] button");
const activeBox = (page: Page) => productFrame(page).locator('[data-feedbacker-overlay] [data-box="active"]');
const connected = (page: Page) => expect(page.getByTestId("connection-state")).toHaveAttribute("data-state", "connected");

test.describe("US3 - review existing feedback", () => {
  test("scenario 1: every feedback of the site is listed, newest first, current page signalled", async ({ page, request }) => {
    await seed(request, { body: "Premier" });
    await seedSecondPage(request, "Deuxième");
    await openProduct(page);
    await connected(page);
    const items = list(page).getByRole("listitem");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("Deuxième");
    await expect(items.nth(1)).toContainText("Premier");
    await expect(itemFor(page, "Premier")).toContainText("Sur cette page");
    await expect(itemFor(page, "Deuxième")).not.toContainText("Sur cette page");
    await expect(markers(page)).toHaveCount(1);
  });

  test("scenario 2: selecting a feedback highlights its element", async ({ page, request }) => {
    await seed(request, { body: "Premier" });
    await openProduct(page);
    await connected(page);
    await itemFor(page, "Premier").getByRole("button").click();
    await expect(activeBox(page)).toBeVisible();
    await expect(itemFor(page, "Premier").getByRole("button")).toHaveAttribute("aria-current", "true");
  });

  test("activating a marker highlights the feedback in the list (FR-015)", async ({ page, request }) => {
    await seed(request, { body: "Premier" });
    await openProduct(page);
    await connected(page);
    await markers(page).click();
    await expect(itemFor(page, "Premier").getByRole("button")).toHaveAttribute("aria-current", "true");
  });

  test("scenario 3: an explicit empty state invites to create the first feedback", async ({ page }) => {
    await openProduct(page);
    await connected(page);
    await expect(page.getByText("Aucun retour pour l'instant")).toBeVisible();
  });

  test("scenario 4: a feedback of another page proposes to go there, then highlights it", async ({ page, request }) => {
    await seedSecondPage(request, "Ailleurs");
    const product = await openProduct(page);
    await connected(page);
    await itemFor(page, "Ailleurs").getByRole("button").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("/second-page");
    await dialog.getByRole("button", { name: "Annuler" }).click();
    await expect(product.getByRole("heading", { name: "Produit de démonstration" })).toBeVisible();

    await itemFor(page, "Ailleurs").getByRole("button").click();
    await dialog.getByRole("button", { name: "Aller sur cette page" }).click();
    await expect(product.getByRole("heading", { name: "Seconde page" })).toBeVisible();
    await expect(activeBox(page)).toBeVisible();
    await expect(itemFor(page, "Ailleurs")).toContainText("Sur cette page");
  });

  test("scenario 5: markers and signal follow a navigation without reload (pushState)", async ({ page, request }) => {
    await seed(request, { body: "Premier" });
    await seedSecondPage(request, "Ailleurs");
    const product = await openProduct(page);
    await connected(page);
    await expect(itemFor(page, "Premier")).toContainText("Sur cette page");

    await product.getByRole("link", { name: /sans recharger/ }).click();
    await expect(product.locator("#location")).toHaveText("/second-page");
    await expect(itemFor(page, "Ailleurs")).toContainText("Sur cette page");
    await expect(itemFor(page, "Premier")).not.toContainText("Sur cette page");
    await expect(markers(page)).toHaveCount(0);
  });

  test("scenario 5: markers and signal follow a navigation with a full reload", async ({ page, request }) => {
    await seed(request, { body: "Premier" });
    const product = await openProduct(page);
    await connected(page);
    await expect(markers(page)).toHaveCount(1);
    await product.getByRole("link", { name: /avec rechargement/ }).click();
    await expect(product.getByRole("heading", { name: "Seconde page" })).toBeVisible();
    await connected(page);
    await expect(itemFor(page, "Premier")).not.toContainText("Sur cette page");
    await expect(markers(page)).toHaveCount(0);
  });

  test("scenario 6: two stakeholders see the same feedback, with no processing status (FR-014, FR-019)", async ({ browser, request }) => {
    await seed(request, { body: "De Camille", authorName: "Camille" });
    await seed(request, { body: "D'Alex", authorName: "Alex" });
    for (let index = 0; index < 2; index += 1) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await openProduct(page);
      await expect(itemFor(page, "De Camille")).toContainText("Camille");
      await expect(itemFor(page, "D'Alex")).toContainText("Alex");
      await expect(page.getByText(/à traiter|traité/i)).toHaveCount(0);
      await context.close();
    }
  });

  test("a feedback left in the same session appears in the list", async ({ page }) => {
    const product = await openProduct(page);
    await connected(page);
    await page.getByRole("button", { name: "Surligner un élément" }).click();
    await product.getByRole("heading", { name: "Produit de démonstration" }).click();
    await page.getByRole("textbox", { name: "Votre retour" }).fill("Tout juste déposé");
    await page.getByRole("button", { name: "Enregistrer le retour" }).click();
    await page.getByRole("textbox", { name: "Votre nom" }).fill("Camille");
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(itemFor(page, "Tout juste déposé")).toContainText("Camille");
    await expect(itemFor(page, "Tout juste déposé")).toContainText("Sur cette page");
  });

  test("an element whose text changed is flagged as approximate (FR-016)", async ({ page, request }) => {
    await seed(request, {
      pagePath: "/changing-content",
      body: "Sur le texte",
      selector: '[data-testid="changing"]',
      tagName: "p",
      textExcerpt: "Texte d'origine",
    });
    const product = await openProduct(page, "/changing-content");
    await connected(page);
    await expect(markers(page)).toHaveCount(1);
    await expect(itemFor(page, "Sur le texte")).not.toContainText("Élément approximatif");

    await product.getByRole("button", { name: "Changer le texte" }).click();
    await expect(itemFor(page, "Sur le texte")).toContainText("Élément approximatif");
    await expect(markers(page)).toHaveCount(1);
  });

  test("a removed element is flagged as not found, with no misleading highlight (FR-016)", async ({ page, request }) => {
    await seed(request, {
      pagePath: "/changing-content",
      body: "Sur le texte",
      selector: '[data-testid="changing"]',
      tagName: "p",
      textExcerpt: "Texte d'origine",
    });
    const product = await openProduct(page, "/changing-content");
    await connected(page);
    await expect(markers(page)).toHaveCount(1);

    await product.getByRole("button", { name: "Supprimer l'élément" }).click();
    await expect(itemFor(page, "Sur le texte")).toContainText("Élément introuvable");
    await expect(markers(page)).toHaveCount(0);
    await itemFor(page, "Sur le texte").getByRole("button").click();
    await expect(activeBox(page)).toHaveCount(0);
    await expect(itemFor(page, "Sur le texte")).toContainText("Texte d'origine");
  });

  test("a product that does not answer keeps the list, without any page signal (FR-004)", async ({ page, request }) => {
    await seed(request, { pagePath: "/no-connector", body: "Sans connecteur" });
    await openProduct(page, "/no-connector");
    await expect(itemFor(page, "Sans connecteur")).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("ne répond pas", { timeout: 15_000 });
    await expect(itemFor(page, "Sans connecteur")).toBeVisible();
    await expect(itemFor(page, "Sans connecteur")).not.toContainText("Sur cette page");
  });

  test("a failed loading offers to retry, and the product stays displayed", async ({ page, request }) => {
    await seed(request, { body: "Premier" });
    let failing = true;
    await page.route("**/api/feedback?**", async (route) => {
      if (failing) await route.fulfill({ status: 500, json: { code: "INTERNAL_ERROR" } });
      else await route.fallback();
    });
    const product = await openProduct(page);
    await expect(product.getByRole("heading", { name: "Produit de démonstration" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "n'ont pas pu être chargés" })).toBeVisible();
    failing = false;
    await page.getByRole("button", { name: "Réessayer" }).click();
    await expect(itemFor(page, "Premier")).toBeVisible();
  });

  test("no accessibility violation while reviewing, frame included (SC-007)", async ({ page, request }) => {
    await seed(request, { body: "Premier" });
    await seedSecondPage(request, "Ailleurs");
    await openProduct(page);
    await connected(page);
    await expect(markers(page)).toHaveCount(1);
    await expectNoAccessibilityViolations(page);
    await itemFor(page, "Premier").getByRole("button").click();
    await expect(activeBox(page)).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await itemFor(page, "Ailleurs").getByRole("button").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });
});
