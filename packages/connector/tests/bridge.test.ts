import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { startBridge } from "../src/bridge.ts";

const TOOL_ORIGIN = "https://feedback.example.com";
const envelope = { source: "feedbacker", version: 1 } as const;

describe("startBridge", () => {
  let frame: HTMLIFrameElement;
  let parent: Window;
  let postMessage: MockInstance<Window["postMessage"]>;
  let stop: (() => void) | null = null;

  const dispatch = (data: unknown, init: { origin?: string; source?: Window | null } = {}) => {
    window.dispatchEvent(
      new MessageEvent("message", { data, origin: init.origin ?? TOOL_ORIGIN, source: init.source === undefined ? parent : init.source }),
    );
  };

  beforeEach(() => {
    frame = document.createElement("iframe");
    document.body.append(frame);
    parent = frame.contentWindow as Window;
    postMessage = vi.spyOn(parent, "postMessage").mockImplementation(() => undefined);
  });

  afterEach(() => {
    stop?.();
    stop = null;
    frame.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("outside an iframe (FR-006b)", () => {
    it("does nothing at all", () => {
      vi.useFakeTimers();
      const addEventListener = vi.spyOn(window, "addEventListener");
      const nodesBefore = document.documentElement.outerHTML;
      stop = startBridge({ self: window, parent: window, toolOrigin: TOOL_ORIGIN });
      expect(stop).toBeNull();
      expect(addEventListener).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      expect(document.documentElement.outerHTML).toBe(nodesBefore);
    });
  });

  describe("in an iframe, before the first verified message (FR-006b)", () => {
    it("only listens to messages and says hello to the tool origin", () => {
      vi.useFakeTimers();
      const addEventListener = vi.spyOn(window, "addEventListener");
      const nodesBefore = document.documentElement.outerHTML;
      stop = startBridge({ self: window, parent, toolOrigin: TOOL_ORIGIN });
      expect(addEventListener.mock.calls.map(([type]) => type)).toEqual(["message"]);
      expect(vi.getTimerCount()).toBe(0);
      expect(document.documentElement.outerHTML).toBe(nodesBefore);
      expect(postMessage).toHaveBeenCalledOnce();
      expect(postMessage).toHaveBeenCalledWith({ ...envelope, type: "connector.hello" }, TOOL_ORIGIN);
    });
  });

  describe("handshake", () => {
    beforeEach(() => {
      stop = startBridge({ self: window, parent, toolOrigin: TOOL_ORIGIN });
      postMessage.mockClear();
    });

    it("answers a verified ping with ready and the current path", () => {
      dispatch({ ...envelope, type: "tool.ping" });
      expect(postMessage).toHaveBeenCalledOnce();
      expect(postMessage).toHaveBeenCalledWith(
        { ...envelope, type: "connector.ready", path: window.location.pathname },
        TOOL_ORIGIN,
      );
    });

    it("never posts with the wildcard target origin", () => {
      dispatch({ ...envelope, type: "tool.ping" });
      expect(postMessage.mock.calls.every((call) => (call[1] as unknown) === TOOL_ORIGIN)).toBe(true);
    });

    it.each([
      ["another origin", { origin: "https://evil.example.com" }],
      ["another source", { source: window }],
      ["no source", { source: null }],
    ])("ignores a ping from %s", (_label, init) => {
      dispatch({ ...envelope, type: "tool.ping" }, init);
      expect(postMessage).not.toHaveBeenCalled();
    });

    it.each([
      ["another source marker", { source: "other", version: 1, type: "tool.ping" }],
      ["another protocol version", { source: "feedbacker", version: 2, type: "tool.ping" }],
      ["an unknown type", { ...envelope, type: "tool.unknown" }],
      ["a string", "tool.ping"],
      ["null", null],
    ])("ignores %s", (_label, data) => {
      dispatch(data);
      expect(postMessage).not.toHaveBeenCalled();
    });

    it("stops listening when stopped", () => {
      stop?.();
      stop = null;
      dispatch({ ...envelope, type: "tool.ping" });
      expect(postMessage).not.toHaveBeenCalled();
    });
  });
});
