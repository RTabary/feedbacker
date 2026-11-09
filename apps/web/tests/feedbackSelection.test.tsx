import type { ConnectorToToolMessage, Feedback, ToolToConnectorPayload } from "@feedbacker/contracts";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFeedbackSelection } from "../src/features/feedback-list/useFeedbackSelection.ts";

const ID_HERE = "00000000-0000-4000-8000-000000000002";
const ID_ELSEWHERE = "00000000-0000-4000-8000-000000000001";
const envelope = { source: "feedbacker", version: 1 } as const;

const feedback = (id: string, pagePath: string): Feedback => ({
  id,
  productOrigin: "https://app.example.com",
  pagePath,
  body: "Retour",
  authorName: "Camille",
  anchor: { selector: "#a", tagName: "a", textExcerpt: "", rect: { x: 0, y: 0, width: 1, height: 1 } },
  displayContext: { viewportWidth: 800, viewportHeight: 600, scrollX: 0, scrollY: 0 },
  createdAt: "2026-11-04T10:00:00.000Z",
});
const here = feedback(ID_HERE, "/a");
const elsewhere = feedback(ID_ELSEWHERE, "/b");
const items = [here, elsewhere];

const setup = () => {
  const send = vi.fn<(payload: ToolToConnectorPayload) => void>();
  const navigate = vi.fn<(path: string) => void>();
  const view = renderHook(
    ({ path, connected }) =>
      useFeedbackSelection({ items, currentPath: path, connected, send, navigate }),
    { initialProps: { path: "/a" as string | null, connected: true } },
  );
  const lastMarkers = () => {
    const calls = send.mock.calls.map(([payload]) => payload).filter((payload) => payload.type === "tool.setMarkers");
    return calls.at(-1) as Extract<ToolToConnectorPayload, { type: "tool.setMarkers" }> | undefined;
  };
  return { send, navigate, lastMarkers, ...view };
};

const resolved = (statuses: { feedbackId: string; status: "exact" | "approximate" | "notFound" }[]): ConnectorToToolMessage => ({
  ...envelope,
  type: "connector.markersResolved",
  statuses,
});

describe("useFeedbackSelection", () => {
  it("sends the markers of the current page once connected", () => {
    const { lastMarkers } = setup();
    expect(lastMarkers()?.markers.map((marker) => marker.feedbackId)).toEqual([ID_HERE]);
    expect(lastMarkers()?.activeFeedbackId).toBeNull();
  });

  it("sends nothing while the product is not connected", () => {
    const { send, rerender } = setup();
    send.mockClear();
    rerender({ path: null, connected: false });
    expect(send).not.toHaveBeenCalled();
  });

  it("selecting a feedback of the current page activates it, without asking (scenario 2)", () => {
    const { result, lastMarkers, navigate } = setup();
    act(() => result.current.select(here));
    expect(result.current.activeFeedbackId).toBe(ID_HERE);
    expect(lastMarkers()?.activeFeedbackId).toBe(ID_HERE);
    expect(result.current.pendingNavigation).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("connector.markerActivated selects the feedback in the list (FR-015)", () => {
    const { result } = setup();
    act(() => result.current.handleMessage({ ...envelope, type: "connector.markerActivated", feedbackId: ID_HERE }));
    expect(result.current.activeFeedbackId).toBe(ID_HERE);
  });

  describe("a feedback of another page (scenario 4)", () => {
    it("proposes to go there and changes nothing yet", () => {
      const { result, navigate } = setup();
      act(() => result.current.select(elsewhere));
      expect(result.current.pendingNavigation).toBe(elsewhere);
      expect(navigate).not.toHaveBeenCalled();
    });

    it("refusing changes nothing", () => {
      const { result, navigate } = setup();
      act(() => result.current.select(elsewhere));
      act(() => result.current.declineNavigation());
      expect(result.current.pendingNavigation).toBeNull();
      expect(result.current.activeFeedbackId).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });

    it("accepting changes the page, then activates the element once there", () => {
      const { result, navigate, rerender, lastMarkers } = setup();
      act(() => result.current.select(elsewhere));
      act(() => result.current.confirmNavigation());
      expect(navigate).toHaveBeenCalledWith("/b");
      expect(result.current.pendingNavigation).toBeNull();

      rerender({ path: null, connected: false });
      rerender({ path: "/b", connected: true });
      expect(result.current.activeFeedbackId).toBe(ID_ELSEWHERE);
      expect(lastMarkers()?.markers.map((marker) => marker.feedbackId)).toEqual([ID_ELSEWHERE]);
      expect(lastMarkers()?.activeFeedbackId).toBe(ID_ELSEWHERE);
    });

    it("also applies when the current page is unknown", () => {
      const { result, rerender } = setup();
      rerender({ path: null, connected: false });
      act(() => result.current.select(here));
      expect(result.current.pendingNavigation).toBe(here);
    });
  });

  it("updates the markers and clears the active feedback when the page changes (scenario 5)", () => {
    const { result, rerender, lastMarkers } = setup();
    act(() => result.current.select(here));
    rerender({ path: "/b", connected: true });
    expect(result.current.activeFeedbackId).toBeNull();
    expect(lastMarkers()?.markers.map((marker) => marker.feedbackId)).toEqual([ID_ELSEWHERE]);
    expect(lastMarkers()?.activeFeedbackId).toBeNull();
  });

  it("keeps the statuses reported by the connector", () => {
    const { result } = setup();
    act(() => result.current.handleMessage(resolved([{ feedbackId: ID_HERE, status: "notFound" }])));
    expect(result.current.statuses.get(ID_HERE)).toBe("notFound");
  });

  it("forgets the statuses when the page changes: they depend on the page displayed", () => {
    const { result, rerender } = setup();
    act(() => result.current.handleMessage(resolved([{ feedbackId: ID_HERE, status: "notFound" }])));
    rerender({ path: "/b", connected: true });
    expect(result.current.statuses.size).toBe(0);
  });
});
