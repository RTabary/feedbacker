import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOverlay, type Overlay } from "../src/overlay.ts";
import { byId, setBody, stubLayout } from "./helpers/dom.ts";

const FEEDBACK_ID = "3f2b8a51-2c1e-4d6f-9a3b-7e1c5d9f0a12";

describe("createOverlay", () => {
  let overlay: Overlay;
  let frames: FrameRequestCallback[];
  let showPopover: ReturnType<typeof vi.fn>;
  const onMarkerActivated = vi.fn();

  const runFrame = () => {
    const pending = frames;
    frames = [];
    for (const callback of pending) callback(0);
  };
  const host = () => document.querySelector("[data-feedbacker-overlay]") as HTMLElement | null;
  const shadow = () => host()?.shadowRoot as ShadowRoot;

  beforeEach(() => {
    frames = [];
    stubLayout({ left: 10, top: 20, width: 100, height: 40 });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      frames = [];
    });
    showPopover = vi.fn();
    HTMLElement.prototype.showPopover = showPopover as unknown as HTMLElement["showPopover"];
    setBody(`<button id="save">Enregistrer</button>`);
    onMarkerActivated.mockClear();
    overlay = createOverlay(document, { onMarkerActivated });
  });

  afterEach(() => {
    overlay.destroy();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("adds nothing to the page until there is something to draw", () => {
    expect(host()).toBeNull();
  });

  it("draws in a shadow DOM, in the top layer", () => {
    overlay.setSelection(byId("save"));
    expect(host()?.shadowRoot).toBeTruthy();
    expect(host()?.getAttribute("popover")).toBe("manual");
    expect(showPopover).toHaveBeenCalled();
  });

  it("leaves the product untouched by the host: it lets pointer events through", () => {
    overlay.setSelection(byId("save"));
    expect(host()?.style.pointerEvents).toBe("none");
  });

  it("uses CSSOM only: no style element and no style attribute set from markup", () => {
    const setAttribute = vi.spyOn(Element.prototype, "setAttribute");
    overlay.setSelection(byId("save"));
    overlay.setMarkers([{ feedbackId: FEEDBACK_ID, ordinal: 1, label: "Retour 1", element: byId("save") }]);
    expect(setAttribute.mock.calls.some(([name]) => name === "style")).toBe(false);
    expect(shadow().querySelector("style")).toBeNull();
  });

  it("positions the selection box on the element", () => {
    overlay.setSelection(byId("save"));
    const box = shadow().querySelector("[data-box='selection']") as HTMLElement;
    expect(box.style.left).toBe("10px");
    expect(box.style.top).toBe("20px");
    expect(box.style.width).toBe("100px");
    expect(box.style.height).toBe("40px");
  });

  it("distinguishes hover and selection by the shape of the outline, not only by color", () => {
    overlay.setSelection(byId("save"));
    overlay.setHover(byId("save"));
    const selection = shadow().querySelector("[data-box='selection']") as HTMLElement;
    const hover = shadow().querySelector("[data-box='hover']") as HTMLElement;
    expect(selection.style.outlineStyle).toBe("solid");
    expect(hover.style.outlineStyle).toBe("dashed");
  });

  it("removes the boxes when cleared", () => {
    overlay.setSelection(byId("save"));
    overlay.setSelection(null);
    expect(host()).toBeNull();
  });

  describe("position updates", () => {
    it("follows the element at each animation frame", () => {
      overlay.setSelection(byId("save"));
      runFrame();
      stubLayout({ left: 50, top: 70, width: 100, height: 40 });
      runFrame();
      const box = shadow().querySelector("[data-box='selection']") as HTMLElement;
      expect(box.style.left).toBe("50px");
      expect(box.style.top).toBe("70px");
    });

    it("stops the loop when there is nothing left to draw", () => {
      overlay.setSelection(byId("save"));
      expect(frames).toHaveLength(1);
      overlay.setSelection(null);
      runFrame();
      expect(frames).toHaveLength(0);
    });
  });

  describe("markers", () => {
    beforeEach(() => {
      overlay.setMarkers([
        { feedbackId: FEEDBACK_ID, ordinal: 3, label: "Retour 3 de Camille", element: byId("save") },
      ]);
    });

    const marker = () => shadow().querySelector("button") as HTMLButtonElement;

    it("are real buttons, labelled by the tool, showing only the ordinal", () => {
      expect(marker().getAttribute("aria-label")).toBe("Retour 3 de Camille");
      expect(marker().textContent).toBe("3");
      expect(marker().getAttribute("type")).toBe("button");
    });

    it("accept pointer events although the host does not", () => {
      expect(marker().style.pointerEvents).toBe("auto");
    });

    it("are large enough for WCAG 2.2 target size", () => {
      expect(Number.parseInt(marker().style.width, 10)).toBeGreaterThanOrEqual(24);
      expect(Number.parseInt(marker().style.height, 10)).toBeGreaterThanOrEqual(24);
    });

    it("report their activation", () => {
      marker().click();
      expect(onMarkerActivated).toHaveBeenCalledWith(FEEDBACK_ID);
    });

    it("can be made non-interactive during annotation", () => {
      overlay.setMarkersInteractive(false);
      expect(marker().style.pointerEvents).toBe("none");
      expect(marker().tabIndex).toBe(-1);
      overlay.setMarkersInteractive(true);
      expect(marker().style.pointerEvents).toBe("auto");
      expect(marker().tabIndex).toBe(0);
    });

    it("are replaced by a new list", () => {
      overlay.setMarkers([]);
      expect(host()).toBeNull();
    });

    it("keep their non-interactive state when replaced", () => {
      overlay.setMarkersInteractive(false);
      overlay.setMarkers([{ feedbackId: FEEDBACK_ID, ordinal: 1, label: "x", element: byId("save") }]);
      expect(marker().style.pointerEvents).toBe("none");
    });
  });

  it("highlights the active element", () => {
    overlay.setActive(byId("save"));
    expect(shadow().querySelector("[data-box='active']")).toBeTruthy();
    overlay.setActive(null);
    expect(host()).toBeNull();
  });

  it("recognises itself", () => {
    overlay.setSelection(byId("save"));
    expect(overlay.isOverlay(host() as Element)).toBe(true);
    expect(overlay.isOverlay(byId("save"))).toBe(false);
  });

  it("removes everything when destroyed", () => {
    overlay.setSelection(byId("save"));
    overlay.destroy();
    expect(host()).toBeNull();
    runFrame();
    expect(frames).toHaveLength(0);
  });

  it("does not disturb the product when the top layer is unavailable", () => {
    HTMLElement.prototype.showPopover = undefined as unknown as HTMLElement["showPopover"];
    expect(() => overlay.setSelection(byId("save"))).not.toThrow();
  });
});
