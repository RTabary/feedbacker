import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { useProductConnection } from "../src/features/product-frame/useProductConnection.ts";
import type { ConnectorToToolMessage } from "@feedbacker/contracts";

const PRODUCT_ORIGIN = "https://app.example.com";
const envelope = { source: "feedbacker", version: 1 } as const;

let latest: ReturnType<typeof useProductConnection>;
const onMessage = vi.fn<(message: ConnectorToToolMessage) => void>();

const Harness = () => {
  latest = useProductConnection({ productOrigin: PRODUCT_ORIGIN, onMessage });
  // Pas de `onLoad` ici : jsdom charge about:blank de lui-même ; les tests déclenchent `onFrameLoad`.
  return <iframe ref={latest.frameRef} title="frame" />;
};

describe("useProductConnection", () => {
  let frameWindow: Window;
  let postMessage: MockInstance<Window["postMessage"]>;

  const dispatch = (data: unknown, init: { origin?: string; source?: Window | null } = {}) => {
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data,
          origin: init.origin ?? PRODUCT_ORIGIN,
          source: init.source === undefined ? frameWindow : init.source,
        }),
      );
    });
  };
  const loadFrame = () => {
    act(() => {
      latest.onFrameLoad();
    });
  };
  const advance = (ms: number) => {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    onMessage.mockClear();
    const { container } = render(<Harness />);
    frameWindow = (container.querySelector("iframe") as HTMLIFrameElement).contentWindow as Window;
    postMessage = vi.spyOn(frameWindow, "postMessage").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const lastPing = () => postMessage.mock.calls.filter((call) => (call[0] as { type: string }).type === "tool.ping");

  it("starts connecting, with an unknown page", () => {
    expect(latest.state).toBe("connecting");
    expect(latest.path).toBeNull();
  });

  it("becomes unresponsive after exactly 10 seconds without answer (FR-004)", () => {
    advance(9999);
    expect(latest.state).toBe("connecting");
    advance(1);
    expect(latest.state).toBe("unresponsive");
  });

  it("pings on load, then connects on ready and cancels the timer", () => {
    loadFrame();
    expect(lastPing()).toHaveLength(1);
    expect(postMessage).toHaveBeenCalledWith({ ...envelope, type: "tool.ping" }, PRODUCT_ORIGIN);
    dispatch({ ...envelope, type: "connector.ready", path: "/orders" });
    expect(latest.state).toBe("connected");
    expect(latest.path).toBe("/orders");
    advance(60_000);
    expect(latest.state).toBe("connected");
  });

  it("pings on hello, which can arrive before the load event", () => {
    dispatch({ ...envelope, type: "connector.hello" });
    expect(lastPing()).toHaveLength(1);
  });

  it("stays connected when ready arrives before the load event", () => {
    dispatch({ ...envelope, type: "connector.hello" });
    dispatch({ ...envelope, type: "connector.ready", path: "/" });
    expect(latest.state).toBe("connected");
    loadFrame();
    dispatch({ ...envelope, type: "connector.ready", path: "/" });
    expect(latest.state).toBe("connected");
  });

  it("clears the unresponsive state when ready arrives late", () => {
    advance(10_000);
    expect(latest.state).toBe("unresponsive");
    dispatch({ ...envelope, type: "connector.hello" });
    dispatch({ ...envelope, type: "connector.ready", path: "/" });
    expect(latest.state).toBe("connected");
  });

  it("rearms the timer on each load and forgets the page (FR-006a)", () => {
    dispatch({ ...envelope, type: "connector.ready", path: "/" });
    loadFrame();
    expect(latest.state).toBe("connecting");
    expect(latest.path).toBeNull();
    advance(9999);
    expect(latest.state).toBe("connecting");
    advance(1);
    expect(latest.state).toBe("unresponsive");
  });

  it.each([
    ["another origin", { origin: "https://evil.example.com" }],
    ["another source", { source: window }],
    ["no source", { source: null }],
  ])("ignores a message from %s", (_label, init) => {
    dispatch({ ...envelope, type: "connector.ready", path: "/" }, init);
    expect(latest.state).toBe("connecting");
    expect(onMessage).not.toHaveBeenCalled();
  });

  it.each([
    ["another version", { source: "feedbacker", version: 2, type: "connector.ready", path: "/" }],
    ["another marker", { source: "other", version: 1, type: "connector.ready", path: "/" }],
    ["an invalid path", { ...envelope, type: "connector.ready", path: "orders" }],
  ])("treats %s as no answer", (_label, data) => {
    dispatch(data);
    expect(latest.state).toBe("connecting");
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("never posts with the wildcard target origin", () => {
    loadFrame();
    dispatch({ ...envelope, type: "connector.hello" });
    act(() => {
      latest.send({ type: "tool.confirmCursor" });
    });
    expect(postMessage.mock.calls.length).toBeGreaterThan(0);
    expect(postMessage.mock.calls.every((call) => (call[1] as unknown) === PRODUCT_ORIGIN)).toBe(true);
  });

  it("follows connector.pageChanged and forwards validated messages", () => {
    dispatch({ ...envelope, type: "connector.ready", path: "/" });
    dispatch({ ...envelope, type: "connector.pageChanged", path: "/orders" });
    expect(latest.path).toBe("/orders");
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "connector.pageChanged", path: "/orders" }));
  });

  it("stops the timer and the listener when unmounted", () => {
    cleanup();
    expect(vi.getTimerCount()).toBe(0);
    const before = onMessage.mock.calls.length;
    window.dispatchEvent(
      new MessageEvent("message", { data: { ...envelope, type: "connector.hello" }, origin: PRODUCT_ORIGIN, source: frameWindow }),
    );
    expect(onMessage.mock.calls.length).toBe(before);
  });
});
