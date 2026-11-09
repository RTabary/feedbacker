import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.tsx";
import { t } from "../src/i18n/t.ts";
import { expectNoAxeViolations } from "./helpers/axe.ts";

const PRODUCT_URL = "https://app.example.com/orders";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const openWith = (search: string) => {
  window.history.replaceState({}, "", `/${search}`);
  return render(<App />);
};
const openProduct = () => openWith(`?url=${encodeURIComponent(PRODUCT_URL)}`);
const stubApi = (implementation: () => Promise<Response>) => vi.stubGlobal("fetch", vi.fn(implementation));

const frame = () => screen.queryByTitle(t("product.frameTitle"));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("App, product display", () => {
  describe("without a usable link", () => {
    beforeEach(() => {
      stubApi(async () => json(200, { items: [] }));
    });

    it("explains how to get a link when the address is missing (FR-001)", async () => {
      const { container } = openWith("");
      expect(screen.getByRole("alert").textContent).toContain(t("product.missingUrl"));
      expect(frame()).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
      await expectNoAxeViolations(container);
    });

    it("refuses an invalid address without loading anything (FR-003)", () => {
      openWith(`?url=${encodeURIComponent("javascript:alert(1)")}`);
      expect(screen.getByRole("alert").textContent).toContain(t("product.invalidUrl"));
      expect(frame()).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  it("does not display the product until the list of sites has answered", async () => {
    stubApi(() => new Promise(() => undefined));
    openProduct();
    expect(frame()).toBeNull();
    expect(screen.getByRole("status", { name: t("common.loading") })).toBeTruthy();
  });

  it("refuses a site outside the list (FR-003a)", async () => {
    stubApi(async () => json(403, { code: "ORIGIN_NOT_ALLOWED" }));
    const { container } = openProduct();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(t("product.notAllowed")));
    expect(frame()).toBeNull();
    await expectNoAxeViolations(container);
  });

  it.each([
    ["a 500", async () => json(500, { code: "INTERNAL_ERROR" })],
    [
      "a network failure",
      async () => {
        throw new TypeError("network");
      },
    ],
  ])("still displays the product after %s from the API", async (_label, implementation) => {
    stubApi(implementation);
    openProduct();
    await waitFor(() => expect(frame()).not.toBeNull());
  });

  describe("with an allowed site", () => {
    beforeEach(() => {
      stubApi(async () => json(200, { items: [] }));
    });

    it("displays the product in a titled frame (FR-002)", async () => {
      const { container } = openProduct();
      await waitFor(() => expect(frame()).not.toBeNull());
      expect(frame()?.getAttribute("src")).toBe(PRODUCT_URL);
      await expectNoAxeViolations(container);
    });

    it("shows a single message after 10 seconds and keeps the product on screen (FR-004)", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      openProduct();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(frame()).not.toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain(t("product.unresponsive"));
      expect(screen.getAllByRole("alert")).toHaveLength(1);
      expect(frame()).not.toBeNull();
    });
  });
});
