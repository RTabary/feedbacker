import type { Anchor } from "@feedbacker/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { resolveAnchor } from "../src/anchor.ts";
import { byId, setBody } from "./helpers/dom.ts";

const anchor = (override: Partial<Anchor> = {}): Anchor => ({
  selector: `[id="target"]`,
  tagName: "button",
  textExcerpt: "Enregistrer",
  rect: { x: 0, y: 0, width: 10, height: 10 },
  ...override,
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("resolveAnchor", () => {
  it("is exact when the selector is unique and the tag and excerpt are identical", () => {
    setBody(`<button id="target">Enregistrer</button>`);
    expect(resolveAnchor(document, anchor())).toEqual({ status: "exact", element: byId("target") });
  });

  it("is exact for an element without text", () => {
    setBody(`<button id="target"></button>`);
    expect(resolveAnchor(document, anchor({ textExcerpt: "" })).status).toBe("exact");
  });

  it("is approximate when the selector is unique but the excerpt differs", () => {
    setBody(`<button id="target">Sauvegarder</button>`);
    expect(resolveAnchor(document, anchor())).toEqual({ status: "approximate", element: byId("target") });
  });

  it("is approximate when the selector fails but the excerpt is unique on the same tag", () => {
    setBody(`<div><button id="moved">Enregistrer</button><button>Annuler</button></div>`);
    expect(resolveAnchor(document, anchor())).toEqual({ status: "approximate", element: byId("moved") });
  });

  it("does not match the excerpt on another tag", () => {
    setBody(`<p>Enregistrer</p>`);
    expect(resolveAnchor(document, anchor())).toEqual({ status: "notFound", element: null });
  });

  it("is not found when the excerpt is shared by several elements", () => {
    setBody(`<button>Enregistrer</button><button>Enregistrer</button>`);
    expect(resolveAnchor(document, anchor())).toEqual({ status: "notFound", element: null });
  });

  it("is not found when nothing matches", () => {
    setBody(`<button>Annuler</button>`);
    expect(resolveAnchor(document, anchor())).toEqual({ status: "notFound", element: null });
  });

  it("does not search an empty excerpt", () => {
    setBody(`<button></button>`);
    expect(resolveAnchor(document, anchor({ textExcerpt: "" }))).toEqual({ status: "notFound", element: null });
  });

  it("does not trust a selector that became ambiguous", () => {
    setBody(`<button data-x="a">Autre</button><button data-x="a">Autre</button>`);
    expect(resolveAnchor(document, anchor({ selector: `[data-x="a"]` }))).toEqual({ status: "notFound", element: null });
  });

  it("falls back on the excerpt when the selector became ambiguous", () => {
    setBody(`<button data-x="a" id="right">Enregistrer</button><button data-x="a">Autre</button>`);
    expect(resolveAnchor(document, anchor({ selector: `[data-x="a"]` }))).toEqual({ status: "approximate", element: byId("right") });
  });

  it("does not trust a selector pointing at another tag", () => {
    setBody(`<a id="target">Autre</a>`);
    expect(resolveAnchor(document, anchor()).status).toBe("notFound");
  });

  it("survives an invalid selector", () => {
    setBody(`<button>Annuler</button>`);
    expect(resolveAnchor(document, anchor({ selector: "[[[" })).status).toBe("notFound");
  });
});
