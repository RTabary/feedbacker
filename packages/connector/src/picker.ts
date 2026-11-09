import type { Anchor, CursorDirection, DisplayContext } from "@feedbacker/contracts";
import { createAnchor, describeElement, type ElementDescription } from "./anchor.ts";
import type { Cursor } from "./cursor.ts";
import type { Overlay } from "./overlay.ts";

const BLOCKED_EVENTS = ["pointerdown", "pointerup", "mousedown", "mouseup", "auxclick", "dragstart"];

export interface ElementSelection {
  anchor: Anchor;
  displayContext: DisplayContext;
  path: string;
}

interface PickerOptions {
  window: Window;
  overlay: Overlay;
  cursor: Cursor;
  onCursorMoved: (description: ElementDescription) => void;
  onSelected: (selection: ElementSelection) => void;
  onCancelled: () => void;
}

export interface Picker {
  enable: () => void;
  disable: () => void;
  move: (direction: CursorDirection) => void;
  confirm: () => void;
}

/** Une dimension fractionnaire (zoom) est arrondie : le contrat attend un entier strictement positif. */
const viewportDimension = (value: number): number => Math.max(1, Math.round(value));

export const createPicker = ({ window, overlay, cursor, onCursorMoved, onSelected, onCancelled }: PickerOptions): Picker => {
  let enabled = false;

  const targetOf = (event: Event): Element | null => {
    const { target } = event;
    if (!(target instanceof Element) || overlay.isOverlay(target)) return null;
    return target === window.document.documentElement ? window.document.body : target;
  };

  const select = (element: Element): void => {
    overlay.setSelection(element);
    onSelected({
      anchor: createAnchor(element),
      displayContext: {
        viewportWidth: viewportDimension(window.innerWidth),
        viewportHeight: viewportDimension(window.innerHeight),
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      },
      path: window.location.pathname,
    });
  };

  const block = (event: Event): void => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const onClick = (event: Event): void => {
    block(event);
    const element = targetOf(event);
    if (element) select(element);
  };

  const onPointerMove = (event: Event): void => {
    const element = targetOf(event);
    if (!element || element === cursor.current()) return;
    cursor.set(element);
    overlay.setHover(element);
    onCursorMoved(describeElement(element));
  };

  const onKeyDown = (event: Event): void => {
    if ((event as KeyboardEvent).key === "Escape") onCancelled();
  };

  return {
    enable: () => {
      if (enabled) return;
      enabled = true;
      overlay.setMarkersInteractive(false);
      for (const type of BLOCKED_EVENTS) window.addEventListener(type, block, true);
      window.addEventListener("click", onClick, true);
      window.addEventListener("pointermove", onPointerMove, true);
      window.addEventListener("keydown", onKeyDown, true);
    },
    disable: () => {
      if (!enabled) return;
      enabled = false;
      for (const type of BLOCKED_EVENTS) window.removeEventListener(type, block, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("keydown", onKeyDown, true);
      cursor.set(null);
      overlay.setHover(null);
      overlay.setMarkersInteractive(true);
    },
    move: (direction) => {
      const element = cursor.move(direction);
      if (!element) return;
      overlay.setHover(element);
      onCursorMoved(describeElement(element));
    },
    confirm: () => {
      const element = cursor.current();
      if (element) select(element);
    },
  };
};
