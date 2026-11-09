import type { CursorDirection } from "@feedbacker/contracts";

const NON_RENDERED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "META", "LINK", "TITLE", "HEAD"]);

export interface Cursor {
  current: () => Element | null;
  set: (element: Element | null) => void;
  move: (direction: CursorDirection) => Element | null;
}

const isIgnoredSubtree = (element: Element): boolean => {
  if (NON_RENDERED_TAGS.has(element.tagName) || element.hasAttribute("data-feedbacker-overlay")) return true;
  const view = element.ownerDocument.defaultView;
  const style = view?.getComputedStyle(element);
  return style?.display === "none" || style?.visibility === "hidden";
};

const hasSize = (element: Element): boolean => {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const collectElements = (document: Document): Element[] => {
  const found: Element[] = [];
  const walk = (parent: Element): void => {
    for (const child of Array.from(parent.children)) {
      if (isIgnoredSubtree(child)) continue;
      if (hasSize(child)) found.push(child);
      walk(child);
    }
  };
  if (document.body) walk(document.body);
  return found;
};

const firstUsableChild = (element: Element): Element | null => {
  for (const child of Array.from(element.children)) {
    if (isIgnoredSubtree(child)) continue;
    if (hasSize(child)) return child;
    const nested = firstUsableChild(child);
    if (nested) return nested;
  }
  return null;
};

export const createCursor = (document: Document): Cursor => {
  let current: Element | null = null;

  const startingPoint = (elements: Element[]): Element | null => {
    const active = document.activeElement;
    if (active && active !== document.body && elements.includes(active)) return active;
    return elements[0] ?? null;
  };

  const target = (element: Element, direction: CursorDirection, elements: Element[]): Element => {
    if (direction === "parent") {
      const parent = element.parentElement;
      return parent && parent !== document.body && parent !== document.documentElement ? parent : element;
    }
    if (direction === "child") return firstUsableChild(element) ?? element;
    const index = elements.indexOf(element);
    const next = elements[index + (direction === "next" ? 1 : -1)];
    return next ?? element;
  };

  return {
    current: () => current,
    set: (element) => {
      current = element;
    },
    move: (direction) => {
      const elements = collectElements(document);
      current = current?.isConnected ? target(current, direction, elements) : startingPoint(elements);
      current?.scrollIntoView({ block: "nearest", inline: "nearest" });
      return current;
    },
  };
};
