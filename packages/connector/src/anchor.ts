import { TEXT_EXCERPT_MAX_LENGTH, type Anchor, type AnchorStatus } from "@feedbacker/contracts";

const STABLE_ATTRIBUTES = ["data-feedback-anchor", "data-testid", "data-test", "data-cy"];
const FORM_CONTROLS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const IGNORED_TEXT_PARENTS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "SELECT"]);
/** Un identifiant contenant un chiffre ou `:` est probablement généré, donc instable d'un rendu à l'autre. */
const GENERATED_ID = /[\d:]/;

const quote = (value: string): string => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const isUnique = (root: ParentNode, selector: string): boolean => root.querySelectorAll(selector).length === 1;

const stableSelector = (element: Element): string | null => {
  const document = element.ownerDocument;
  for (const attribute of STABLE_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (value) {
      const selector = `[${attribute}=${quote(value)}]`;
      if (isUnique(document, selector)) return selector;
    }
  }
  if (element.id && !GENERATED_ID.test(element.id)) {
    const selector = `[id=${quote(element.id)}]`;
    if (isUnique(document, selector)) return selector;
  }
  return null;
};

const pathSegment = (element: Element): string => {
  const tag = element.tagName.toLowerCase();
  const parent = element.parentElement;
  if (!parent) return tag;
  const sameTag = Array.from(parent.children).filter((child) => child.tagName === element.tagName);
  return `${tag}:nth-of-type(${sameTag.indexOf(element) + 1})`;
};

export const buildSelector = (element: Element): string => {
  const segments: string[] = [];
  let current: Element | null = element;
  while (current) {
    const stable = stableSelector(current);
    if (stable) {
      segments.unshift(stable);
      break;
    }
    if (current === current.ownerDocument.documentElement) {
      segments.unshift("html");
      break;
    }
    segments.unshift(pathSegment(current));
    current = current.parentElement;
  }
  return segments.join(" > ");
};

const truncate = (text: string): string => Array.from(text).slice(0, TEXT_EXCERPT_MAX_LENGTH).join("");

const normalise = (text: string): string => text.replace(/\s+/g, " ").trim();

const visibleText = (element: Element): string => {
  const parts: string[] = [];
  let length = 0;
  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (length > TEXT_EXCERPT_MAX_LENGTH * 4) return;
      if (child.nodeType === 3) {
        const value = child.nodeValue ?? "";
        parts.push(value);
        length += value.length;
      } else if (child.nodeType === 1 && !IGNORED_TEXT_PARENTS.has((child as Element).tagName)) {
        // Un élément de formulaire ou de bloc sépare les mots qui l'entourent.
        parts.push(" ");
        walk(child);
        parts.push(" ");
      } else if (child.nodeType === 1) {
        parts.push(" ");
      }
    }
  };
  walk(element);
  return normalise(parts.join(""));
};

const accessibleAttribute = (element: Element, attributes: string[]): string => {
  for (const attribute of attributes) {
    const value = element.getAttribute(attribute);
    if (value) return normalise(value);
  }
  return "";
};

/** La valeur d'un champ n'est jamais lue : elle peut contenir une donnée personnelle (research.md R13). */
const excerptOf = (element: Element): string => {
  if (FORM_CONTROLS.has(element.tagName)) return accessibleAttribute(element, ["aria-label", "placeholder", "name"]);
  return visibleText(element) || accessibleAttribute(element, ["aria-label", "alt", "title"]);
};

export interface ElementDescription {
  tagName: string;
  textExcerpt: string;
}

export const describeElement = (element: Element): ElementDescription => ({
  tagName: element.tagName.toLowerCase(),
  textExcerpt: truncate(excerptOf(element)),
});

export const createAnchor = (element: Element): Anchor => {
  const rect = element.getBoundingClientRect();
  const view = element.ownerDocument.defaultView;
  return {
    selector: buildSelector(element),
    ...describeElement(element),
    rect: {
      x: rect.left + (view?.scrollX ?? 0),
      y: rect.top + (view?.scrollY ?? 0),
      width: rect.width,
      height: rect.height,
    },
  };
};

export interface ResolvedAnchor {
  status: AnchorStatus;
  element: Element | null;
}

const NOT_FOUND: ResolvedAnchor = { status: "notFound", element: null };

const matchSelector = (document: Document, anchor: Anchor): Element | null => {
  try {
    const matches = document.querySelectorAll(anchor.selector);
    const [only] = matches;
    return matches.length === 1 && only && only.tagName.toLowerCase() === anchor.tagName ? only : null;
  } catch {
    return null;
  }
};

/** Indique le statut réel plutôt que d'afficher une mise en évidence trompeuse (FR-016). */
export const resolveAnchor = (document: Document, anchor: Anchor): ResolvedAnchor => {
  const bySelector = matchSelector(document, anchor);
  if (bySelector) {
    const same = describeElement(bySelector).textExcerpt === anchor.textExcerpt;
    return { status: same ? "exact" : "approximate", element: bySelector };
  }
  if (!anchor.textExcerpt) return NOT_FOUND;
  const byExcerpt = Array.from(document.getElementsByTagName(anchor.tagName)).filter(
    (candidate) => describeElement(candidate).textExcerpt === anchor.textExcerpt,
  );
  const [only] = byExcerpt;
  return byExcerpt.length === 1 && only ? { status: "approximate", element: only } : NOT_FOUND;
};
