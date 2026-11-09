export interface OverlayMarker {
  feedbackId: string;
  ordinal: number;
  label: string;
  element: Element;
}

export interface Overlay {
  setHover: (element: Element | null) => void;
  setSelection: (element: Element | null) => void;
  setActive: (element: Element | null) => void;
  setMarkers: (markers: OverlayMarker[]) => void;
  setMarkersInteractive: (interactive: boolean) => void;
  isOverlay: (element: Element) => boolean;
  destroy: () => void;
}

interface OverlayOptions {
  onMarkerActivated: (feedbackId: string) => void;
}

type BoxName = "hover" | "selection" | "active";

const OUTLINE_STYLE: Record<BoxName, string> = { hover: "dashed", selection: "solid", active: "double" };
const OUTLINE_WIDTH: Record<BoxName, string> = { hover: "2px", selection: "3px", active: "4px" };
const MARKER_SIZE_PX = 28;
// Bleu foncé et halo blanc : le contour reste visible sur un fond clair comme sur un fond sombre.
const ACCENT = "#1f4fbf";
const HALO = "0 0 0 2px #ffffff";

const px = (value: number): string => `${value}px`;

/**
 * Dessine dans le produit, dans un Shadow DOM placé dans la top layer (research.md R3). Les styles passent
 * par le CSSOM, que `style-src` ne bloque pas. L'hôte n'existe que lorsqu'il y a quelque chose à dessiner.
 */
export const createOverlay = (document: Document, { onMarkerActivated }: OverlayOptions): Overlay => {
  let host: HTMLElement | null = null;
  let root: ShadowRoot | null = null;
  let frame: number | null = null;
  let interactive = true;
  let markers: OverlayMarker[] = [];
  const boxElements = new Map<BoxName, HTMLElement>();
  const boxTargets = new Map<BoxName, Element>();
  const markerButtons = new Map<OverlayMarker, HTMLButtonElement>();

  const ensureHost = (): ShadowRoot => {
    if (host && root) return root;
    host = document.createElement("div");
    host.setAttribute("data-feedbacker-overlay", "");
    host.setAttribute("popover", "manual");
    const { style } = host;
    style.setProperty("position", "fixed");
    style.setProperty("inset", "0");
    style.setProperty("width", "100%");
    style.setProperty("height", "100%");
    style.setProperty("margin", "0");
    style.setProperty("padding", "0");
    style.setProperty("border", "0");
    style.setProperty("background", "transparent");
    style.setProperty("overflow", "visible");
    style.setProperty("pointer-events", "none");
    style.setProperty("z-index", "2147483647");
    style.setProperty("display", "block");
    root = host.attachShadow({ mode: "open" });
    (document.body ?? document.documentElement).append(host);
    return root;
  };

  const bringToTop = (): void => {
    if (!host || typeof host.showPopover !== "function") return;
    try {
      // Rouvrir place l'hôte au-dessus des <dialog> modaux ouverts entre-temps.
      if (host.matches(":popover-open")) host.hidePopover();
      host.showPopover();
    } catch {
      // Sans top layer, le z-index maximal reste actif : le produit n'est pas perturbé.
    }
  };

  const place = (element: HTMLElement, target: Element): void => {
    const rect = target.getBoundingClientRect();
    element.style.setProperty("left", px(rect.left));
    element.style.setProperty("top", px(rect.top));
    element.style.setProperty("width", px(rect.width));
    element.style.setProperty("height", px(rect.height));
  };

  const placeMarker = (button: HTMLElement, target: Element): void => {
    const rect = target.getBoundingClientRect();
    button.style.setProperty("left", px(Math.max(0, rect.left - MARKER_SIZE_PX / 2)));
    button.style.setProperty("top", px(Math.max(0, rect.top - MARKER_SIZE_PX / 2)));
  };

  const hasContent = (): boolean => boxTargets.size > 0 || markers.length > 0;

  const updatePositions = (): void => {
    for (const [name, target] of boxTargets) {
      const element = boxElements.get(name);
      if (element) place(element, target);
    }
    for (const [marker, button] of markerButtons) placeMarker(button, marker.element);
  };

  const scheduleLoop = (): void => {
    if (frame !== null) return;
    const tick = (): void => {
      frame = null;
      if (!hasContent()) return;
      updatePositions();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };

  const removeHostIfEmpty = (): void => {
    if (hasContent() || !host) return;
    host.remove();
    host = null;
    root = null;
    boxElements.clear();
    markerButtons.clear();
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };

  const setBox = (name: BoxName, target: Element | null): void => {
    if (!target) {
      boxTargets.delete(name);
      boxElements.get(name)?.remove();
      boxElements.delete(name);
      removeHostIfEmpty();
      return;
    }
    const shadow = ensureHost();
    let box = boxElements.get(name);
    if (!box) {
      box = document.createElement("div");
      box.setAttribute("data-box", name);
      box.style.setProperty("position", "fixed");
      box.style.setProperty("pointer-events", "none");
      box.style.setProperty("box-sizing", "border-box");
      box.style.setProperty("outline-style", OUTLINE_STYLE[name]);
      box.style.setProperty("outline-width", OUTLINE_WIDTH[name]);
      box.style.setProperty("outline-color", ACCENT);
      box.style.setProperty("box-shadow", HALO);
      shadow.append(box);
      boxElements.set(name, box);
    }
    boxTargets.set(name, target);
    place(box, target);
    bringToTop();
    scheduleLoop();
  };

  const applyInteractivity = (button: HTMLButtonElement): void => {
    button.style.setProperty("pointer-events", interactive ? "auto" : "none");
    button.tabIndex = interactive ? 0 : -1;
  };

  const createMarkerButton = (marker: OverlayMarker): HTMLButtonElement => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", marker.label);
    button.textContent = String(marker.ordinal);
    const { style } = button;
    style.setProperty("position", "fixed");
    // Au-dessus des contours : le numéro doit rester lisible quand l'élément est mis en évidence.
    style.setProperty("z-index", "1");
    style.setProperty("width", px(MARKER_SIZE_PX));
    style.setProperty("height", px(MARKER_SIZE_PX));
    style.setProperty("padding", "0");
    style.setProperty("border", "2px solid #ffffff");
    style.setProperty("border-radius", "50%");
    style.setProperty("background", ACCENT);
    style.setProperty("color", "#ffffff");
    style.setProperty("font", "700 13px/1 system-ui, sans-serif");
    style.setProperty("cursor", "pointer");
    applyInteractivity(button);
    button.addEventListener("click", () => {
      onMarkerActivated(marker.feedbackId);
    });
    placeMarker(button, marker.element);
    return button;
  };

  return {
    setHover: (element) => {
      setBox("hover", element);
    },
    setSelection: (element) => {
      setBox("selection", element);
    },
    setActive: (element) => {
      setBox("active", element);
    },
    setMarkers: (next) => {
      for (const button of markerButtons.values()) button.remove();
      markerButtons.clear();
      markers = next;
      if (next.length === 0) {
        removeHostIfEmpty();
        return;
      }
      const shadow = ensureHost();
      for (const marker of next) {
        const button = createMarkerButton(marker);
        markerButtons.set(marker, button);
        shadow.append(button);
      }
      bringToTop();
      scheduleLoop();
    },
    setMarkersInteractive: (value) => {
      interactive = value;
      for (const button of markerButtons.values()) applyInteractivity(button);
    },
    isOverlay: (element) => element === host,
    destroy: () => {
      boxTargets.clear();
      markers = [];
      removeHostIfEmpty();
    },
  };
};
