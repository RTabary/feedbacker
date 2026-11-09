import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startBridge } from "../src/bridge.ts";
import { createPageTracker } from "../src/pageTracker.ts";

describe("createPageTracker", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    onChange.mockClear();
    window.history.replaceState({}, "", "/start");
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState({}, "", "/");
  });

  it("reports nothing while the path does not change", () => {
    const stop = createPageTracker(window, onChange);
    vi.advanceTimersByTime(5000);
    expect(onChange).not.toHaveBeenCalled();
    stop();
  });

  it("reports a change once, within 500 ms", () => {
    const stop = createPageTracker(window, onChange);
    window.history.pushState({}, "", "/orders");
    vi.advanceTimersByTime(499);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("/orders");
    vi.advanceTimersByTime(5000);
    expect(onChange).toHaveBeenCalledOnce();
    stop();
  });

  it("ignores query parameters and fragments", () => {
    const stop = createPageTracker(window, onChange);
    window.history.pushState({}, "", "/start?id=1#top");
    vi.advanceTimersByTime(1000);
    expect(onChange).not.toHaveBeenCalled();
    stop();
  });

  it("does not modify the history API of the product (FR-006b)", () => {
    const { pushState, replaceState } = window.history;
    const stop = createPageTracker(window, onChange);
    expect(window.history.pushState).toBe(pushState);
    expect(window.history.replaceState).toBe(replaceState);
    stop();
  });

  it("stops polling when stopped", () => {
    const stop = createPageTracker(window, onChange);
    stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("page tracking in the bridge", () => {
  const TOOL_ORIGIN = "https://feedback.example.com";
  const envelope = { source: "feedbacker", version: 1 } as const;

  it("only starts polling after the first verified message (FR-006b)", () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/start");
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const parent = frame.contentWindow as Window;
    const postMessage = vi.spyOn(parent, "postMessage").mockImplementation(() => undefined);
    const stop = startBridge({ self: window, parent, toolOrigin: TOOL_ORIGIN });
    expect(vi.getTimerCount()).toBe(0);

    window.dispatchEvent(new MessageEvent("message", { data: { ...envelope, type: "tool.ping" }, origin: TOOL_ORIGIN, source: parent }));
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    postMessage.mockClear();
    window.history.pushState({}, "", "/orders");
    vi.advanceTimersByTime(500);
    expect(postMessage).toHaveBeenCalledWith({ ...envelope, type: "connector.pageChanged", path: "/orders" }, TOOL_ORIGIN);

    stop?.();
    expect(vi.getTimerCount()).toBe(0);
    frame.remove();
    window.history.replaceState({}, "", "/");
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
