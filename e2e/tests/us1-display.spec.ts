import { OTHER_URL, PRODUCT_URL, TOOL_URL } from "./helpers/urls.ts";
import { UNRESPONSIVE_TIMEOUT_MS, expect, expectNoAccessibilityViolations, openProduct, productFrame, test, toolPath } from "./helpers/tool.ts";

const UNRESPONSIVE_TEXT = /ne répond pas/;

test.describe("US1 - display the product", () => {
  test("scenario 1: a valid link displays the product and it stays usable (FR-002)", async ({ page }) => {
    const product = await openProduct(page);
    await expect(product.getByRole("heading", { name: "Produit de démonstration" })).toBeVisible();
    await product.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(product.locator("#count")).toHaveText("1");
    await product.getByRole("textbox", { name: "Rechercher une commande" }).fill("abc");
    await expect(product.getByRole("textbox", { name: "Rechercher une commande" })).toHaveValue("abc");
    await product.getByRole("link", { name: /avec rechargement/ }).click();
    await expect(product.getByRole("heading", { name: "Seconde page" })).toBeVisible();
  });

  test("scenario 2: a link without address explains how to get one", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("alert")).toContainText("Aucun produit");
    await expect(page.locator("iframe")).toHaveCount(0);
  });

  test("scenario 3: a malformed address loads nothing and runs nothing", async ({ page }) => {
    let dialogOpened = false;
    page.on("dialog", (dialog) => {
      dialogOpened = true;
      void dialog.dismiss();
    });
    await page.goto(toolPath("javascript:alert(1)"));
    await expect(page.getByRole("alert")).toContainText("n'est pas valide");
    await expect(page.locator("iframe")).toHaveCount(0);
    expect(dialogOpened).toBe(false);
  });

  test("scenario 4: a site outside the list is refused (FR-003a)", async ({ page }) => {
    await page.goto(toolPath(`${OTHER_URL}/`));
    await expect(page.getByRole("alert")).toContainText("n'est pas autorisé");
    await expect(page.locator("iframe")).toHaveCount(0);
  });

  test("scenario 5: an existing session is recognised and login works inside the tool (FR-002a)", async ({ page, browserName }) => {
    // WebKit traite *.fixture.localhost comme des sites différents et bloque le cookie. Sur un vrai domaine
    // enregistrable (feedback.lvh.me, app.lvh.me), la session y fonctionne : mesuré, voir research.md R9.
    test.skip(browserName === "webkit", "fixture host names are not same-site in WebKit; see research.md R9");
    const product = await openProduct(page, "/login");
    await expect(product.locator("#status")).toHaveText("Non connecté");
    await product.getByRole("button", { name: "Se connecter" }).click();
    await expect(product.locator("#status")).toHaveText("Session active");
    await page.reload();
    await expect(productFrame(page).locator("#status")).toHaveText("Session active");
  });

  test("scenario 6: a product refusing to be framed gets the single message (FR-004)", async ({ page }) => {
    await openProduct(page, "/refuses-framing");
    await expect(page.getByRole("alert")).toContainText(UNRESPONSIVE_TEXT, { timeout: UNRESPONSIVE_TIMEOUT_MS });
    await expect(page.getByRole("alert")).toHaveCount(1);
  });

  test("a product without connector stays usable, with the same message (FR-004)", async ({ page }) => {
    const product = await openProduct(page, "/no-connector");
    await expect(page.getByRole("alert")).toContainText(UNRESPONSIVE_TEXT, { timeout: UNRESPONSIVE_TIMEOUT_MS });
    await expect(product.getByRole("heading", { name: "Page sans connecteur" })).toBeVisible();
  });

  test("a late connector clears the message without reloading", async ({ page }) => {
    await openProduct(page, "/slow-connector");
    await expect(page.getByRole("alert")).toContainText(UNRESPONSIVE_TEXT, { timeout: UNRESPONSIVE_TIMEOUT_MS });
    await expect(page.getByRole("alert")).toHaveCount(0, { timeout: UNRESPONSIVE_TIMEOUT_MS });
  });

  test("the connector establishes the connection on a normal page", async ({ page }) => {
    await openProduct(page);
    await expect(page.getByTestId("connection-state")).toHaveAttribute("data-state", "connected");
  });

  test("navigation to a site outside the list is blocked in the frame (R8)", async ({ page }) => {
    const blocked: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes(OTHER_URL) || message.text().toLowerCase().includes("content security policy")) {
        blocked.push(message.text());
      }
    });
    const product = await openProduct(page, "/external-link");
    await product.locator("#external").click();
    await expect.poll(() => blocked.length).toBeGreaterThan(0);
    expect(page.frames().some((frame) => frame.url().startsWith(OTHER_URL))).toBe(false);
  });

  test("the tool sends the CSP listing exactly the allowed sites", async ({ request }) => {
    const response = await request.get(TOOL_URL);
    expect(response.headers()["content-security-policy"]).toContain(`frame-src ${PRODUCT_URL};`);
  });

  test("opening the product directly has no effect and no console error (FR-006b)", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${PRODUCT_URL}/`);
    await page.waitForLoadState("load");
    await expect(page.getByRole("heading", { name: "Produit de démonstration" })).toBeVisible();
    await expect(page.locator("[popover]")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("no accessibility violation, product frame included (SC-007)", async ({ page }) => {
    await openProduct(page);
    await expect(page.getByTestId("connection-state")).toHaveAttribute("data-state", "connected");
    await expectNoAccessibilityViolations(page);
  });
});
