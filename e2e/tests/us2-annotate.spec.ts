import type { FrameLocator, Page } from "@playwright/test";
import { expect, expectNoAccessibilityViolations, openProduct, productFrame, test } from "./helpers/tool.ts";

const NAME = "Camille";

const annotationButton = (page: Page) => page.getByRole("button", { name: "Surligner un élément" });
const form = (page: Page) => page.getByRole("textbox", { name: "Votre retour" });
const submit = (page: Page) => page.getByRole("button", { name: "Enregistrer le retour" });

const connect = async (page: Page, path = "/"): Promise<FrameLocator> => {
  const product = await openProduct(page, path);
  await expect(annotationButton(page)).toBeEnabled();
  return product;
};

/** Clic dans le produit : un toucher sur le projet mobile. */
const pressInProduct = async (page: Page, locator: ReturnType<FrameLocator["locator"]>) => {
  if (test.info().project.name === "mobile") {
    await locator.tap();
  } else {
    await locator.click();
  }
};

const selectElement = async (page: Page, product: FrameLocator, locator: ReturnType<FrameLocator["locator"]>) => {
  await annotationButton(page).click();
  await pressInProduct(page, locator);
  await expect(form(page)).toBeVisible();
  return product;
};

const fillName = async (page: Page) => {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Votre nom" }).fill(NAME);
  await dialog.getByRole("button", { name: "Continuer" }).click();
};

const overlayBox = (page: Page, box: "selection" | "hover") =>
  productFrame(page).locator(`[data-feedbacker-overlay] [data-box="${box}"]`);
const markers = (page: Page) => productFrame(page).locator("[data-feedbacker-overlay] button");

test.describe("US2 - annotate an element", () => {
  test("scenarios 1, 2 and 9: select, write and save; the name is asked once", async ({ page }) => {
    const product = await connect(page);
    const button = product.getByRole("button", { name: "Ajouter au panier" });

    await selectElement(page, product, button);
    await expect(overlayBox(page, "selection")).toBeVisible();

    await form(page).fill("Ce bouton est trop petit");
    await submit(page).click();
    await fillName(page);
    await expect(page.getByRole("status").filter({ hasText: "Votre retour est enregistré" })).toBeVisible();
    await expect(form(page)).toBeHidden();
    await expect(markers(page)).toHaveCount(1);

    await selectElement(page, product, product.getByRole("heading", { name: "Produit de démonstration" }));
    await form(page).fill("Second retour");
    await submit(page).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(markers(page)).toHaveCount(2);
  });

  test("the product does not react to the annotation click", async ({ page }) => {
    const product = await connect(page);
    const button = product.getByRole("button", { name: "Ajouter au panier" });
    await selectElement(page, product, button);
    await expect(product.locator("#count")).toHaveText("0");
  });

  test("scenario 3: cancelling saves nothing and removes the highlight", async ({ page }) => {
    const product = await connect(page);
    await selectElement(page, product, product.getByRole("button", { name: "Ajouter au panier" }));
    await form(page).fill("Finalement non");
    await page.getByRole("button", { name: "Annuler" }).click();
    await expect(form(page)).toBeHidden();
    await expect(overlayBox(page, "selection")).toHaveCount(0);
    await page.reload();
    await expect(annotationButton(page)).toBeEnabled();
    await expect(markers(page)).toHaveCount(0);
  });

  test("scenario 4: an empty text is refused", async ({ page }) => {
    const product = await connect(page);
    await selectElement(page, product, product.getByRole("button", { name: "Ajouter au panier" }));
    await submit(page).click();
    await expect(page.getByText("Le texte du retour est requis")).toBeVisible();
    await expect(form(page)).toBeVisible();
  });

  test("scenario 5: a failed save keeps the text; the new attempt creates no duplicate (FR-011)", async ({ page }) => {
    const product = await connect(page);
    await selectElement(page, product, product.getByRole("button", { name: "Ajouter au panier" }));
    await form(page).fill("Texte à conserver");

    // La réponse est perdue après l'enregistrement : c'est le cas qui créerait un doublon.
    let dropped = false;
    await page.route("**/api/feedback", async (route) => {
      if (route.request().method() === "POST" && !dropped) {
        dropped = true;
        await route.fetch();
        await route.abort();
        return;
      }
      await route.fallback();
    });

    await submit(page).click();
    await fillName(page);
    await expect(page.getByRole("alert").filter({ hasText: "n'a pas pu être enregistré" })).toBeVisible();
    await expect(form(page)).toHaveValue("Texte à conserver");

    await submit(page).click();
    await expect(page.getByRole("status").filter({ hasText: "Votre retour est enregistré" })).toBeVisible();
    await expect(markers(page)).toHaveCount(1);
    await page.reload();
    await expect(annotationButton(page)).toBeEnabled();
    await expect(markers(page)).toHaveCount(1);
  });

  test("scenario 6: without annotation mode, the product behaves normally (FR-005)", async ({ page }) => {
    const product = await connect(page);
    await product.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(product.locator("#count")).toHaveText("1");
    await expect(form(page)).toBeHidden();
    await annotationButton(page).click();
    await annotationButton(page).click();
    await product.getByRole("button", { name: "Ajouter au panier" }).click();
    await expect(product.locator("#count")).toHaveText("2");
    await expect(form(page)).toBeHidden();
  });

  test("scenarios 7 and 8: annotation is unavailable until the product answers", async ({ page }) => {
    await openProduct(page, "/slow-connector");
    await expect(annotationButton(page)).toBeDisabled();
    await expect(page.getByRole("alert")).toContainText("ne répond pas", { timeout: 15_000 });
    await expect(annotationButton(page)).toBeDisabled();
    await expect(annotationButton(page)).toBeEnabled({ timeout: 15_000 });
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("the focus returns to the form after a click in the frame (R5)", async ({ page }) => {
    const product = await connect(page);
    await selectElement(page, product, product.getByRole("button", { name: "Ajouter au panier" }));
    await expect(form(page)).toBeFocused();
    await page.keyboard.type("Saisie directe");
    await expect(form(page)).toHaveValue("Saisie directe");
  });

  test("hovering pre-signals the element and announces it", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "no hover on a touch screen");
    const product = await connect(page);
    await annotationButton(page).click();
    await product.getByRole("button", { name: "Ajouter au panier" }).hover();
    await expect(overlayBox(page, "hover")).toBeVisible();
    await expect(page.getByTestId("annotation-announcement")).toContainText("Ajouter au panier");
  });

  test("the highlight follows scrolling, resizing and inner scroll containers (FR-006)", async ({ page }) => {
    const product = await connect(page);
    const innerButton = product.getByTestId("inner-button");
    await selectElement(page, product, innerButton);
    const box = overlayBox(page, "selection");

    const aligned = async () => {
      const [element, highlight] = await Promise.all([innerButton.boundingBox(), box.boundingBox()]);
      if (!element || !highlight) return false;
      return Math.abs(element.x - highlight.x) <= 1 && Math.abs(element.y - highlight.y) <= 1;
    };
    await expect.poll(aligned).toBe(true);

    const startY = (await box.boundingBox())?.y;
    await product.locator("#inner-scroll").evaluate((element) => element.scrollBy(0, 40));
    await expect.poll(async () => (await box.boundingBox())?.y).not.toBe(startY);
    await expect.poll(aligned).toBe(true);

    await product.locator("html").evaluate(() => window.scrollBy(0, 60));
    await expect.poll(aligned).toBe(true);

    await page.setViewportSize({ width: 700, height: 500 });
    await expect.poll(aligned).toBe(true);
  });

  test("the feedback and its marker are identical after a reload (SC-003)", async ({ page }) => {
    const product = await connect(page);
    await selectElement(page, product, product.getByRole("button", { name: "Ajouter au panier" }));
    await form(page).fill("Retour durable 👍");
    await submit(page).click();
    await fillName(page);
    await expect(markers(page)).toHaveCount(1);
    const label = await markers(page).getAttribute("aria-label");

    await page.reload();
    await expect(annotationButton(page)).toBeEnabled();
    await expect(markers(page)).toHaveCount(1);
    expect(await markers(page).getAttribute("aria-label")).toBe(label);
    await expect(markers(page)).toHaveText("1");
  });

  test("complete journey with the keyboard only, widening to the parent (FR-009)", async ({ page, browserName }) => {
    test.skip(test.info().project.name === "mobile", "no keyboard on the mobile project");
    await connect(page);
    await annotationButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("toolbar")).toBeFocused();

    const announcement = page.getByTestId("annotation-announcement");
    await page.keyboard.press("ArrowRight");
    await expect(overlayBox(page, "hover")).toBeVisible();
    await expect(announcement).toContainText("main");
    await page.keyboard.press("ArrowRight");
    await expect(announcement).toContainText("h1");
    await page.keyboard.press("ArrowUp");
    await expect(announcement).toContainText("main");
    await page.keyboard.press("ArrowDown");
    await expect(announcement).toContainText("h1");
    await page.keyboard.press("ArrowUp");
    await expect(announcement).toContainText("main");

    await page.keyboard.press("Enter");
    await expect(form(page)).toBeFocused();
    await page.keyboard.type("Depuis le clavier");
    if (browserName === "webkit") {
      // Par défaut, Tab n'atteint pas les boutons dans Safari (réglage du navigateur, Option+Tab) : on les focalise.
      await submit(page).focus();
    } else {
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Annuler" })).toBeFocused();
      await page.keyboard.press("Tab");
    }
    await expect(submit(page)).toBeFocused();
    await page.keyboard.press("Enter");

    await page.getByRole("textbox", { name: "Votre nom" }).fill(NAME);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Votre retour est enregistré" })).toBeVisible();
    await expect(markers(page)).toHaveCount(1);
  });

  test("Escape in the product cancels annotation", async ({ page }) => {
    test.skip(test.info().project.name === "mobile", "no keyboard on the mobile project");
    const product = await connect(page);
    await annotationButton(page).click();
    await product.getByRole("heading", { name: "Produit de démonstration" }).hover();
    await product.locator("body").evaluate(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await expect(annotationButton(page)).toHaveAttribute("aria-pressed", "false");
  });

  test("the name can be modified at any time (FR-012)", async ({ page }) => {
    await connect(page);
    await page.getByRole("button", { name: "Définir mon nom" }).click();
    await page.getByRole("textbox", { name: "Votre nom" }).fill(NAME);
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByText(NAME, { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Modifier mon nom" }).click();
    await page.getByRole("textbox", { name: "Votre nom" }).fill("Alex");
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByText("Alex", { exact: false })).toBeVisible();
  });

  test("the draft survives an expired product session; the feedback is saved after reconnection", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "fixture host names are not same-site in WebKit; see research.md R9");
    const product = await connect(page, "/login");
    await product.getByRole("button", { name: "Se connecter" }).click();
    await expect(product.locator("#status")).toHaveText("Session active");
    await expect(annotationButton(page)).toBeEnabled();

    await selectElement(page, product, product.getByTestId("account"));
    await form(page).fill("Brouillon à conserver");
    await product.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(product.locator("#status")).toHaveText("Non connecté");
    await expect(form(page)).toHaveValue("Brouillon à conserver");

    await product.getByRole("button", { name: "Se connecter" }).click();
    await expect(product.locator("#status")).toHaveText("Session active");
    await submit(page).click();
    await fillName(page);
    await expect(page.getByRole("status").filter({ hasText: "Votre retour est enregistré" })).toBeVisible();
  });

  test("works under the strict CSP of the product: nothing is blocked by the overlay (R3)", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (message.text().toLowerCase().includes("content security policy")) violations.push(message.text());
    });
    const product = await connect(page);
    await selectElement(page, product, product.getByRole("button", { name: "Ajouter au panier" }));
    await expect(overlayBox(page, "selection")).toBeVisible();
    expect(violations).toEqual([]);
  });

  test("no form value ever leaves the product (R13)", async ({ page }) => {
    const product = await connect(page);
    await selectElement(page, product, product.getByRole("textbox", { name: "Rechercher une commande" }));
    const request = page.waitForRequest((candidate) => candidate.method() === "POST");
    await form(page).fill("Champ ambigu");
    await submit(page).click();
    await fillName(page);
    const body = (await request).postData() ?? "";
    expect(body).toContain("Rechercher une commande");
    expect(body).not.toContain("secret-search");
  });

  test("no accessibility violation while annotating and with a marker, frame included (FR-018)", async ({ page }) => {
    const product = await connect(page);
    await annotationButton(page).click();
    await expectNoAccessibilityViolations(page);
    await pressInProduct(page, product.getByRole("button", { name: "Ajouter au panier" }));
    await expect(form(page)).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await form(page).fill("Retour");
    await submit(page).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await page.getByRole("textbox", { name: "Votre nom" }).fill(NAME);
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(markers(page)).toHaveCount(1);
    await expectNoAccessibilityViolations(page);
  });
});
