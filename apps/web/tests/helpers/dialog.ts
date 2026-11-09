import { vi } from "vitest";

/** jsdom n'implémente pas `showModal` : le simule en ouvrant l'élément, le navigateur est testé en e2e. */
export const stubDialog = (): void => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
};
