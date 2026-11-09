import type { AnchorStatus, Feedback } from "@feedbacker/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackList } from "../src/features/feedback-list/FeedbackList.tsx";
import { formatDateTime, t } from "../src/i18n/t.ts";
import { expectNoAxeViolations } from "./helpers/axe.ts";

const ID_NEW = "00000000-0000-4000-8000-000000000002";
const ID_OLD = "00000000-0000-4000-8000-000000000001";

const feedback = (id: string, override: Partial<Feedback> = {}): Feedback => ({
  id,
  productOrigin: "https://app.example.com",
  pagePath: "/a",
  body: "Le libellé est ambigu",
  authorName: "Camille",
  anchor: { selector: "#a", tagName: "button", textExcerpt: "Enregistrer", rect: { x: 0, y: 0, width: 1, height: 1 } },
  displayContext: { viewportWidth: 800, viewportHeight: 600, scrollX: 0, scrollY: 0 },
  createdAt: "2026-11-04T10:00:00.000Z",
  ...override,
});

const onSelect = vi.fn();
const onRetry = vi.fn();

const setup = (
  props: Partial<React.ComponentProps<typeof FeedbackList>> = {},
) =>
  render(
    <FeedbackList
      state={{ status: "ready", items: [feedback(ID_NEW, { body: "Récent" }), feedback(ID_OLD, { body: "Ancien", pagePath: "/b" })] }}
      currentPath="/a"
      statuses={new Map<string, AnchorStatus>()}
      activeFeedbackId={null}
      onSelect={onSelect}
      onRetry={onRetry}
      {...props}
    />,
  );

const items = () => screen.getAllByRole("listitem");

beforeEach(() => {
  onSelect.mockClear();
  onRetry.mockClear();
  // jsdom n'implémente pas scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe("FeedbackList", () => {
  it("keeps the order received: most recent first (FR-014)", () => {
    setup();
    expect(items().map((item) => within(item).getByText(/Récent|Ancien/).textContent)).toEqual(["Récent", "Ancien"]);
  });

  it("gives the count with the French plural", () => {
    setup();
    expect(screen.getByRole("heading", { name: t("feedbackList.count", { count: 2 }) })).toBeTruthy();
  });

  it("shows the author and the date formatted by Intl", () => {
    setup();
    const [first] = items();
    expect(within(first as HTMLElement).getByText(/Camille/)).toBeTruthy();
    expect(within(first as HTMLElement).getByText(new RegExp(formatDateTime("2026-11-04T10:00:00.000Z")))).toBeTruthy();
  });

  it("numbers the feedback like its marker: from the oldest", () => {
    setup();
    const [first, second] = items();
    expect(within(first as HTMLElement).getByRole("button").textContent).toContain("2");
    expect(within(second as HTMLElement).getByRole("button").textContent).toContain("1");
  });

  it("never interprets HTML in a feedback", () => {
    setup({ state: { status: "ready", items: [feedback(ID_NEW, { body: "<img src=x onerror=alert(1)>", authorName: "<b>x</b>" })] } });
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("b")).toBeNull();
  });

  describe("states (FR-017)", () => {
    it("shows the loading state", () => {
      setup({ state: { status: "loading" } });
      expect(screen.getByRole("status", { name: t("common.loading") })).toBeTruthy();
    });

    it("invites to create the first feedback when empty", () => {
      setup({ state: { status: "ready", items: [] } });
      expect(screen.getByText(t("feedbackList.empty"))).toBeTruthy();
      expect(screen.queryByRole("list")).toBeNull();
    });

    it("shows an error with a retry button", async () => {
      setup({ state: { status: "error" } });
      expect(screen.getByRole("alert").textContent).toContain(t("feedbackList.loadFailed"));
      await userEvent.click(screen.getByRole("button", { name: t("common.retry") }));
      expect(onRetry).toHaveBeenCalledOnce();
    });
  });

  describe("current page", () => {
    it("signals the feedback of the current page with text, not only with color", () => {
      setup({ currentPath: "/a" });
      const [current, other] = items();
      expect(within(current as HTMLElement).getByText(t("feedbackList.onThisPage"))).toBeTruthy();
      expect(within(other as HTMLElement).queryByText(t("feedbackList.onThisPage"))).toBeNull();
      expect(within(other as HTMLElement).getByText(t("feedbackList.onPage", { path: "/b" }))).toBeTruthy();
    });

    it("signals nothing when the current page is unknown (FR-004)", () => {
      setup({ currentPath: null });
      expect(screen.queryByText(t("feedbackList.onThisPage"))).toBeNull();
      expect(screen.getByText(t("feedbackList.onPage", { path: "/a" }))).toBeTruthy();
    });
  });

  describe("element status (FR-016)", () => {
    it.each([
      ["approximate", "feedbackList.approximate"],
      ["notFound", "feedbackList.notFound"],
    ] as const)("indicates %s on the current page", (status, key) => {
      setup({ statuses: new Map([[ID_NEW, status]]) });
      expect(within(items()[0] as HTMLElement).getByText(t(key))).toBeTruthy();
    });

    it("says nothing for an exact element", () => {
      setup({ statuses: new Map([[ID_NEW, "exact"]]) });
      expect(screen.queryByText(t("feedbackList.approximate"))).toBeNull();
      expect(screen.queryByText(t("feedbackList.notFound"))).toBeNull();
    });

    it("recalls the text of the annotated element, useful when it cannot be found any more", () => {
      setup({ statuses: new Map([[ID_NEW, "notFound"]]) });
      expect(within(items()[0] as HTMLElement).getByText(/Enregistrer/)).toBeTruthy();
    });
  });

  it("has no processing status at all (FR-014)", () => {
    setup();
    expect(screen.queryByText(/traité|à traiter/i)).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("selects a feedback with a real button", async () => {
    setup();
    await userEvent.click(within(items()[1] as HTMLElement).getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: ID_OLD }));
  });

  it("exposes and brings into view the active feedback", () => {
    setup({ activeFeedbackId: ID_OLD });
    const button = within(items()[1] as HTMLElement).getByRole("button");
    expect(button.getAttribute("aria-current")).toBe("true");
    expect(within(items()[0] as HTMLElement).getByRole("button").getAttribute("aria-current")).toBeNull();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("passes the accessibility audit in each state", async () => {
    const { container, rerender } = setup();
    await expectNoAxeViolations(container);
    const common = {
      currentPath: "/a",
      statuses: new Map<string, AnchorStatus>(),
      activeFeedbackId: null,
      onSelect,
      onRetry,
    };
    rerender(<FeedbackList {...common} state={{ status: "ready", items: [] }} />);
    await expectNoAxeViolations(container);
    rerender(<FeedbackList {...common} state={{ status: "error" }} />);
    await expectNoAxeViolations(container);
    rerender(<FeedbackList {...common} state={{ status: "loading" }} />);
    await expectNoAxeViolations(container);
  });
});
