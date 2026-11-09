import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnnotationToolbar } from "../src/features/annotation/AnnotationToolbar.tsx";
import { t } from "../src/i18n/t.ts";
import { expectNoAxeViolations } from "./helpers/axe.ts";

const handlers = {
  onToggle: vi.fn(),
  onMove: vi.fn(),
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

const setup = (props: Partial<React.ComponentProps<typeof AnnotationToolbar>> = {}) =>
  render(<AnnotationToolbar available picking announcement="" {...handlers} {...props} />);

beforeEach(() => {
  Object.values(handlers).forEach((handler) => handler.mockClear());
});
afterEach(cleanup);

const toggle = () => screen.getByRole("button", { name: t("annotation.toggle") });
const toolbar = () => screen.getByRole("toolbar", { name: t("annotation.toolbarLabel") });

describe("AnnotationToolbar", () => {
  describe("annotation button (FR-005)", () => {
    it("exposes its state with aria-pressed", () => {
      setup({ picking: false });
      expect(toggle().getAttribute("aria-pressed")).toBe("false");
      cleanup();
      setup({ picking: true });
      expect(toggle().getAttribute("aria-pressed")).toBe("true");
    });

    it("toggles the mode", async () => {
      setup({ picking: false });
      await userEvent.click(toggle());
      expect(handlers.onToggle).toHaveBeenCalledOnce();
    });

    it("is unavailable and explained when the product is not connected (FR-006a)", async () => {
      setup({ available: false, picking: false });
      const button = toggle() as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      const describedBy = button.getAttribute("aria-describedby") as string;
      expect(document.getElementById(describedBy)?.textContent).toBe(t("annotation.unavailable"));
      await userEvent.click(button);
      expect(handlers.onToggle).not.toHaveBeenCalled();
    });
  });

  describe("when not picking", () => {
    it("shows no movement control", () => {
      setup({ picking: false });
      expect(screen.queryByRole("toolbar")).toBeNull();
    });
  });

  describe("when picking", () => {
    it.each([
      ["annotation.next", "next"],
      ["annotation.previous", "previous"],
      ["annotation.parent", "parent"],
      ["annotation.child", "child"],
    ] as const)("the %s button moves the cursor", async (key, direction) => {
      setup();
      await userEvent.click(screen.getByRole("button", { name: t(key) }));
      expect(handlers.onMove).toHaveBeenCalledWith(direction);
    });

    it.each([
      ["ArrowRight", "next"],
      ["ArrowLeft", "previous"],
      ["ArrowUp", "parent"],
      ["ArrowDown", "child"],
    ])("the %s key moves the cursor", (key, direction) => {
      setup();
      fireEvent.keyDown(toolbar(), { key });
      expect(handlers.onMove).toHaveBeenCalledWith(direction);
    });

    it("confirms with the dedicated button", async () => {
      setup();
      await userEvent.click(screen.getByRole("button", { name: t("annotation.confirm") }));
      expect(handlers.onConfirm).toHaveBeenCalledOnce();
    });

    it("moves the focus to the toolbar and confirms with Enter", async () => {
      setup();
      expect(document.activeElement).toBe(toolbar());
      await userEvent.keyboard("{Enter}");
      expect(handlers.onConfirm).toHaveBeenCalledOnce();
    });

    it("keeps Enter on a button to that button", async () => {
      setup();
      screen.getByRole("button", { name: t("annotation.next") }).focus();
      await userEvent.keyboard("{Enter}");
      expect(handlers.onMove).toHaveBeenCalledWith("next");
      expect(handlers.onConfirm).not.toHaveBeenCalled();
    });

    it("cancels with Escape", async () => {
      setup();
      await userEvent.keyboard("{Escape}");
      expect(handlers.onCancel).toHaveBeenCalledOnce();
    });

    it("explains how to proceed", () => {
      setup();
      expect(screen.getByText(t("annotation.help"))).toBeTruthy();
    });

    it("gives the buttons a target of at least 24 pixels via the shared Button", () => {
      setup();
      expect(screen.getByRole("button", { name: t("annotation.next") }).className).toContain("button");
    });
  });

  it("announces the description in a live region (R5)", () => {
    setup({ announcement: "bouton « Enregistrer »" });
    const live = screen.getByRole("status");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe("bouton « Enregistrer »");
  });

  it("keeps the live region mounted, so that the first announcement is read", () => {
    setup({ picking: false, announcement: "" });
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("passes the accessibility audit", async () => {
    const { container } = setup({ announcement: "bouton" });
    await expectNoAxeViolations(container);
  });
});
