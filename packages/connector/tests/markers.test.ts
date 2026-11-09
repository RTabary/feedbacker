import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { startBridge } from "../src/bridge.ts";
import { byId, setBody, stubLayout } from "./helpers/dom.ts";

const TOOL_ORIGIN = "https://feedback.example.com";
const envelope = { source: "feedbacker", version: 1 } as const;
const ID_A = "00000000-0000-4000-8000-00000000000a";
const ID_B = "00000000-0000-4000-8000-00000000000b";

const marker = (feedbackId: string, selector: string, textExcerpt = "Enregistrer") => ({
  feedbackId,
  ordinal: 1,
  label: "Retour",
  anchor: { selector, tagName: "button", textExcerpt, rect: { x: 0, y: 0, width: 1, height: 1 } },
});

describe("markers in the bridge", () => {
  let frame: HTMLIFrameElement;
  let parent: Window;
  let postMessage: MockInstance<Window["postMessage"]>;
  let stop: (() => void) | null;

  const dispatch = (payload: Record<string, unknown>) => {
    window.dispatchEvent(new MessageEvent("message", { data: { ...envelope, ...payload }, origin: TOOL_ORIGIN, source: parent }));
  };
  const setMarkers = (markers: unknown[], activeFeedbackId: string | null = null) => {
    dispatch({ type: "tool.setMarkers", markers, activeFeedbackId });
  };
  const resolutions = () =>
    postMessage.mock.calls
      .map((call) => call[0] as { type: string; statuses?: unknown })
      .filter((message) => message.type === "connector.markersResolved")
      .map((message) => message.statuses);
  const overlay = () => document.querySelector("[data-feedbacker-overlay]")?.shadowRoot ?? null;

  beforeEach(() => {
    vi.useFakeTimers();
    stubLayout();
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    HTMLElement.prototype.showPopover = vi.fn() as unknown as HTMLElement["showPopover"];
    frame = document.createElement("iframe");
    document.body.append(frame);
    parent = frame.contentWindow as Window;
    postMessage = vi.spyOn(parent, "postMessage").mockImplementation(() => undefined);
    setBody(`<button id="save">Enregistrer</button>`);
    document.body.append(frame);
    stop = startBridge({ self: window, parent, toolOrigin: TOOL_ORIGIN });
    dispatch({ type: "tool.ping" });
    postMessage.mockClear();
  });

  afterEach(() => {
    stop?.();
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("replaces the markers and reports the statuses", () => {
    setMarkers([marker(ID_A, `[id="save"]`), marker(ID_B, `[id="gone"]`, "Disparu")]);
    expect(resolutions()).toEqual([
      [
        { feedbackId: ID_A, status: "exact" },
        { feedbackId: ID_B, status: "notFound" },
      ],
    ]);
    expect(overlay()?.querySelectorAll("button")).toHaveLength(1);
    setMarkers([]);
    expect(overlay()).toBeNull();
  });

  it("retries every 500 ms and only reports when a status changes", () => {
    setMarkers([marker(ID_A, `[id="later"]`, "Arrive plus tard")]);
    postMessage.mockClear();
    vi.advanceTimersByTime(2000);
    expect(resolutions()).toEqual([]);

    const late = document.createElement("button");
    late.id = "later";
    late.textContent = "Arrive plus tard";
    document.body.append(late);
    vi.advanceTimersByTime(500);
    expect(resolutions()).toEqual([[{ feedbackId: ID_A, status: "exact" }]]);
    expect(overlay()?.querySelectorAll("button")).toHaveLength(1);

    vi.advanceTimersByTime(2000);
    expect(resolutions()).toHaveLength(1);
  });

  it("resolves again an element replaced by a new render", () => {
    setMarkers([marker(ID_A, `[id="save"]`)]);
    byId("save").remove();
    postMessage.mockClear();
    vi.advanceTimersByTime(500);
    expect(resolutions()).toEqual([[{ feedbackId: ID_A, status: "notFound" }]]);
    expect(overlay()).toBeNull();

    const replacement = document.createElement("button");
    replacement.id = "save";
    replacement.textContent = "Enregistrer";
    document.body.append(replacement);
    vi.advanceTimersByTime(500);
    expect(overlay()?.querySelectorAll("button")).toHaveLength(1);
  });

  it("reports an element whose text changed as approximate", () => {
    setMarkers([marker(ID_A, `[id="save"]`)]);
    byId("save").textContent = "Autre texte";
    postMessage.mockClear();
    vi.advanceTimersByTime(500);
    expect(resolutions()).toEqual([[{ feedbackId: ID_A, status: "approximate" }]]);
  });

  it("does not draw anything for a marker that is not found, not even its saved rectangle (FR-016)", () => {
    setMarkers([marker(ID_B, `[id="gone"]`, "Disparu")], ID_B);
    expect(overlay()).toBeNull();
  });

  it("highlights the active element", () => {
    setMarkers([marker(ID_A, `[id="save"]`)], ID_A);
    expect(overlay()?.querySelector("[data-box='active']")).toBeTruthy();
    setMarkers([marker(ID_A, `[id="save"]`)], null);
    expect(overlay()?.querySelector("[data-box='active']")).toBeNull();
  });

  it("keeps the markers on screen without recreating them when nothing changes, so the focus is not lost", () => {
    setMarkers([marker(ID_A, `[id="save"]`)]);
    const button = overlay()?.querySelector("button");
    vi.advanceTimersByTime(2000);
    expect(overlay()?.querySelector("button")).toBe(button);
  });

  it("keeps the marker buttons when only the active feedback changes, so a keyboard user keeps the focus", () => {
    setMarkers([marker(ID_A, `[id="save"]`)]);
    const button = overlay()?.querySelector("button");
    setMarkers([marker(ID_A, `[id="save"]`)], ID_A);
    expect(overlay()?.querySelector("button")).toBe(button);
    expect(overlay()?.querySelector("[data-box='active']")).toBeTruthy();
  });

  it("clears the markers and stops retrying with an empty list", () => {
    setMarkers([marker(ID_A, `[id="gone"]`, "Disparu")]);
    setMarkers([]);
    postMessage.mockClear();
    vi.advanceTimersByTime(2000);
    expect(resolutions()).toEqual([]);
  });
});
