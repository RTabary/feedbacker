import axe from "axe-core";
import { expect } from "vitest";

/** Vérifie l'absence de violation WCAG de niveau A ou AA (constitution, principe III). */
export const expectNoAxeViolations = async (container: Element): Promise<void> => {
  const results = await axe.run(container, {
    // jsdom ne charge pas les cadres : l'audit du cadre du produit est fait par les tests e2e.
    iframes: false,
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    // jsdom ne calcule ni rendu ni couleurs : le contraste est vérifié par les tests e2e.
    rules: { "color-contrast": { enabled: false } },
  });
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
};
