import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCursor } from "../src/cursor.ts";
import { createPicker, type Picker } from "../src/picker.ts";
import type { Overlay } from "../src/overlay.ts";
import { byId, setBody, stubLayout, stubScrollIntoView } from "./helpers/dom.ts";

const BLOCKED = ["click", "pointerdown", "pointerup", "mousedown", "mouseup", "auxclick", "dragstart"] as const;

const fakeOverlay = (): Overlay => ({
  setHover: vi.fn(),
  setSelection: vi.fn(),
  setActive: vi.fn(),
  setMarkers: vi.fn(),
  setMarkersInteractive: vi.fn(),
  isOverlay: (element) => element.hasAttribute("data-feedbacker-overlay"),
  destroy: vi.fn(),
});

describe("createPicker", () => {
  let overlay: Overlay;
  let picker: Picker;
  let productHandler: ReturnType<typeof vi.fn>;
  const onCursorMoved = vi.fn();
  const onSelected = vi.fn();
  const onCancelled = vi.fn();

  const fire = (target: EventTarget, type: string, init: MouseEventInit = {}) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, ...init });
    target.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    stubLayout();
    stubScrollIntoView();
    onCursorMoved.mockClear();
    onSelected.mockClear();
    onCancelled.mockClear();
    setBody(`<div id="card"><button id="save">Enregistrer</button><p id="other">Autre</p></div>`);
    productHandler = vi.fn();
    byId("save").addEventListener("click", productHandler as EventListener);
    overlay = fakeOverlay();
    picker = createPicker({ window, overlay, cursor: createCursor(document), onCursorMoved, onSelected, onCancelled });
  });

  afterEach(() => {
    picker.disable();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  describe("outside annotation mode (FR-005)", () => {
    it("adds no listener", () => {
      const addEventListener = vi.spyOn(window, "addEventListener");
      createPicker({ window, overlay, cursor: createCursor(document), onCursorMoved, onSelected, onCancelled });
      expect(addEventListener).not.toHaveBeenCalled();
    });

    it("lets the product react", () => {
      const event = fire(byId("save"), "click");
      expect(productHandler).toHaveBeenCalledOnce();
      expect(event.defaultPrevented).toBe(false);
      expect(onSelected).not.toHaveBeenCalled();
    });
  });

  describe("in annotation mode", () => {
    beforeEach(() => {
      picker.enable();
    });

    it.each(BLOCKED)("blocks %s before the product sees it", (type) => {
      const handler = vi.fn();
      byId("save").addEventListener(type, handler);
      const event = fire(byId("save"), type);
      expect(handler).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
    });

    it.each(["wheel", "scroll", "touchmove", "keydown"])("does not block %s", (type) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      byId("save").dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });

    it("signals the hovered element and reports it once", () => {
      fire(byId("save"), "pointermove");
      fire(byId("save"), "pointermove");
      expect(overlay.setHover).toHaveBeenLastCalledWith(byId("save"));
      expect(onCursorMoved).toHaveBeenCalledOnce();
      expect(onCursorMoved).toHaveBeenCalledWith({ tagName: "button", textExcerpt: "Enregistrer" });
    });

    it("selects the clicked element with its anchor, display context and path", () => {
      fire(byId("save"), "click");
      expect(productHandler).not.toHaveBeenCalled();
      expect(onSelected).toHaveBeenCalledOnce();
      expect(onSelected).toHaveBeenCalledWith({
        anchor: expect.objectContaining({ selector: `[id="save"]`, tagName: "button", textExcerpt: "Enregistrer" }),
        displayContext: { viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, scrollX: 0, scrollY: 0 },
        path: window.location.pathname,
      });
      expect(overlay.setSelection).toHaveBeenCalledWith(byId("save"));
    });

    it("keeps the display context valid with a fractional viewport", () => {
      vi.spyOn(window, "innerWidth", "get").mockReturnValue(1280.5);
      fire(byId("save"), "click");
      const [payload] = onSelected.mock.calls[0] as [{ displayContext: { viewportWidth: number } }];
      expect(Number.isInteger(payload.displayContext.viewportWidth)).toBe(true);
    });

    it("selects the body rather than the root element", () => {
      fire(document.documentElement, "click");
      expect(overlay.setSelection).toHaveBeenCalledWith(document.body);
    });

    it("ignores events on its own overlay", () => {
      const host = document.createElement("div");
      host.setAttribute("data-feedbacker-overlay", "");
      document.body.append(host);
      fire(host, "click");
      fire(host, "pointermove");
      expect(onSelected).not.toHaveBeenCalled();
      expect(onCursorMoved).not.toHaveBeenCalled();
    });

    it("cancels on Escape", () => {
      const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      byId("save").dispatchEvent(event);
      expect(onCancelled).toHaveBeenCalledOnce();
    });

    it("ignores the other keys", () => {
      byId("save").dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
      expect(onCancelled).not.toHaveBeenCalled();
    });

    it("moves the cursor from the last hovered element", () => {
      fire(byId("save"), "pointermove");
      picker.move("parent");
      expect(overlay.setHover).toHaveBeenLastCalledWith(byId("card"));
      expect(onCursorMoved).toHaveBeenLastCalledWith({ tagName: "div", textExcerpt: "Enregistrer Autre" });
    });

    it("confirms the element under the cursor", () => {
      picker.move("next");
      picker.confirm();
      expect(onSelected).toHaveBeenCalledOnce();
      expect(overlay.setSelection).toHaveBeenCalledWith(byId("card"));
    });

    it("confirms nothing when the cursor has not moved", () => {
      picker.confirm();
      expect(onSelected).not.toHaveBeenCalled();
    });

    it("disables the markers during annotation, and restores them at the end", () => {
      expect(overlay.setMarkersInteractive).toHaveBeenLastCalledWith(false);
      picker.disable();
      expect(overlay.setMarkersInteractive).toHaveBeenLastCalledWith(true);
    });
  });

  describe("when disabled", () => {
    it("removes every listener and the hover", () => {
      picker.enable();
      fire(byId("save"), "pointermove");
      picker.disable();
      expect(overlay.setHover).toHaveBeenLastCalledWith(null);
      const event = fire(byId("save"), "click");
      expect(event.defaultPrevented).toBe(false);
      expect(productHandler).toHaveBeenCalledOnce();
      expect(onSelected).not.toHaveBeenCalled();
      byId("save").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(onCancelled).not.toHaveBeenCalled();
    });

    it("can be enabled twice without doubling the listeners", () => {
      picker.enable();
      picker.enable();
      fire(byId("save"), "click");
      expect(onSelected).toHaveBeenCalledOnce();
    });
  });
});
