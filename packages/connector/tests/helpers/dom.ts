import { vi } from "vitest";

/** jsdom ne calcule pas la mise en page : donne une taille non nulle à tous les éléments. */
export const stubLayout = (rect: Partial<DOMRect> = {}): void => {
  const value = { x: 10, y: 20, left: 10, top: 20, right: 110, bottom: 60, width: 100, height: 40, ...rect };
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => ({ ...value, toJSON: () => value }));
};

export const stubScrollIntoView = () => {
  const scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  return scrollIntoView;
};

export const setBody = (html: string): void => {
  document.body.innerHTML = html;
};

export const byId = (id: string): HTMLElement => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element;
};
