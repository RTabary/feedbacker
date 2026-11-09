import type { ConnectorToToolMessage, ToolToConnectorPayload } from "@feedbacker/contracts";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAnnotationSession } from "../src/features/annotation/useAnnotationSession.ts";

const envelope = { source: "feedbacker", version: 1 } as const;
const anchor = { selector: "#a", tagName: "button", textExcerpt: "Enregistrer", rect: { x: 0, y: 0, width: 1, height: 1 } };
const selected: ConnectorToToolMessage = {
  ...envelope,
  type: "connector.elementSelected",
  anchor,
  displayContext: { viewportWidth: 800, viewportHeight: 600, scrollX: 0, scrollY: 0 },
  path: "/orders",
};

const setup = (connected = true) => {
  const send = vi.fn<(payload: ToolToConnectorPayload) => void>();
  const view = renderHook(({ state }) => useAnnotationSession({ connectionState: state, send }), {
    initialProps: { state: connected ? "connected" : "connecting" } as { state: "connected" | "connecting" | "unresponsive" },
  });
  return { send, ...view };
};

describe("useAnnotationSession", () => {
  it("starts idle", () => {
    expect(setup().result.current.mode).toBe("idle");
  });

  it("toggles annotation mode and tells the connector", () => {
    const { result, send } = setup();
    act(() => result.current.toggle());
    expect(result.current.mode).toBe("picking");
    expect(send).toHaveBeenLastCalledWith({ type: "tool.setAnnotationMode", enabled: true });
    act(() => result.current.toggle());
    expect(result.current.mode).toBe("idle");
    expect(send).toHaveBeenLastCalledWith({ type: "tool.setAnnotationMode", enabled: false });
  });

  it("opens a draft with a generated id when an element is selected, and leaves annotation mode", () => {
    const { result, send } = setup();
    act(() => result.current.toggle());
    act(() => result.current.handleMessage(selected));
    expect(result.current.mode).toBe("drafting");
    expect(result.current.draft).toMatchObject({ anchor, path: "/orders" });
    expect(result.current.draft?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(send).toHaveBeenLastCalledWith({ type: "tool.setAnnotationMode", enabled: false });
  });

  it("gives each draft its own id", () => {
    const { result } = setup();
    act(() => result.current.handleMessage(selected));
    const first = result.current.draft?.id;
    act(() => result.current.closeDraft());
    act(() => result.current.handleMessage(selected));
    expect(result.current.draft?.id).not.toBe(first);
  });

  it("keeps the same id over several reads of the same draft, for safe retries", () => {
    const { result, rerender } = setup();
    act(() => result.current.handleMessage(selected));
    const id = result.current.draft?.id;
    rerender({ state: "connected" });
    expect(result.current.draft?.id).toBe(id);
  });

  it("cancels on connector.selectionCancelled", () => {
    const { result, send } = setup();
    act(() => result.current.toggle());
    act(() => result.current.handleMessage({ ...envelope, type: "connector.selectionCancelled" }));
    expect(result.current.mode).toBe("idle");
    expect(send).toHaveBeenLastCalledWith({ type: "tool.setAnnotationMode", enabled: false });
  });

  it("announces the element under the cursor", () => {
    const { result } = setup();
    act(() => result.current.toggle());
    act(() =>
      result.current.handleMessage({ ...envelope, type: "connector.cursorMoved", tagName: "button", textExcerpt: "OK" }),
    );
    expect(result.current.announcement).toContain("OK");
    expect(result.current.announcement).toContain("button");
  });

  it("clears the selection in the product when the draft is closed", () => {
    const { result, send } = setup();
    act(() => result.current.handleMessage(selected));
    act(() => result.current.closeDraft());
    expect(result.current.mode).toBe("idle");
    expect(result.current.draft).toBeNull();
    expect(send).toHaveBeenLastCalledWith({ type: "tool.clearSelection" });
  });

  it("leaves annotation mode when the connection is lost: the new page knows nothing about it", () => {
    const { result, rerender } = setup();
    act(() => result.current.toggle());
    rerender({ state: "connecting" });
    expect(result.current.mode).toBe("idle");
  });

  it("keeps the draft when the product changes page or loses the session", () => {
    const { result, rerender } = setup();
    act(() => result.current.handleMessage(selected));
    const { draft } = result.current;
    rerender({ state: "connecting" });
    expect(result.current.mode).toBe("drafting");
    expect(result.current.draft).toBe(draft);
    act(() => result.current.handleMessage({ ...envelope, type: "connector.pageChanged", path: "/other" }));
    expect(result.current.draft).toBe(draft);
  });

  it("does not start annotation when the product is not connected", () => {
    const { result, send } = setup(false);
    act(() => result.current.toggle());
    expect(result.current.mode).toBe("idle");
    expect(send).not.toHaveBeenCalled();
  });
});
