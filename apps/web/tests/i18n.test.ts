import { describe, expect, it } from "vitest";
import { formatDateTime, t } from "../src/i18n/t.ts";

describe("t", () => {
  it("returns a French message", () => {
    expect(t("common.retry")).toBe("Réessayer");
  });

  it("replaces parameters", () => {
    expect(t("common.characterCount", { count: 12, max: 5000 })).toBe("12 / 5000 caractères");
  });

  it("selects the French plural form", () => {
    expect(t("feedbackList.count", { count: 0 })).toBe("0 retour");
    expect(t("feedbackList.count", { count: 1 })).toBe("1 retour");
    expect(t("feedbackList.count", { count: 2 })).toBe("2 retours");
  });

  it("rejects an unknown key at compile time", () => {
    // @ts-expect-error la clé n'existe pas dans le catalogue typé
    expect(() => t("does.not.exist")).toThrow();
  });
});

describe("formatDateTime", () => {
  it("formats a date in French, in the given time zone", () => {
    expect(formatDateTime("2026-11-04T10:00:00.000Z", "UTC")).toBe("4 novembre 2026 à 10:00");
  });
});
