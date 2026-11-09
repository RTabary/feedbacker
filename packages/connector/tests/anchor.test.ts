import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSelector, createAnchor, describeElement } from "../src/anchor.ts";
import { byId, setBody, stubLayout } from "./helpers/dom.ts";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("buildSelector", () => {
  it.each([
    ["data-feedback-anchor", `<button id="a" data-feedback-anchor="save" data-testid="t" data-test="u" data-cy="v">x</button>`, `[data-feedback-anchor="save"]`],
    ["data-testid", `<button id="a" data-testid="t" data-test="u" data-cy="v">x</button>`, `[data-testid="t"]`],
    ["data-test", `<button id="a" data-test="u" data-cy="v">x</button>`, `[data-test="u"]`],
    ["data-cy", `<button id="a" data-cy="v">x</button>`, `[data-cy="v"]`],
    ["a stable id", `<button id="save">x</button>`, `[id="save"]`],
  ])("prefers %s, in order of priority", (_label, html, expected) => {
    setBody(html);
    expect(buildSelector(document.querySelector("button") as Element)).toBe(expected);
  });

  it.each(["save-2", "radix-12", ":r1:"])("does not trust the generated id %s", (id) => {
    setBody(`<div><button>x</button><button id="${id}">y</button></div>`);
    const target = document.querySelectorAll("button")[1] as Element;
    const selector = buildSelector(target);
    expect(selector).not.toContain(id);
    expect(selector).toContain("button:nth-of-type(2)");
    expect(document.querySelector(selector)).toBe(target);
  });

  it("never uses classes", () => {
    setBody(`<div class="css-abc123"><button class="btn primary">x</button></div>`);
    const selector = buildSelector(document.querySelector("button") as Element);
    expect(selector).not.toContain("css-abc123");
    expect(selector).not.toContain("btn");
  });

  it("builds a unique path, anchored on the closest stable ancestor", () => {
    setBody(`<section data-testid="card"><p>a</p><p><span>b</span><span id="target-1">c</span></p></section>`);
    const target = byId("target-1");
    const selector = buildSelector(target);
    expect(selector).toBe(`[data-testid="card"] > p:nth-of-type(2) > span:nth-of-type(2)`);
    expect(document.querySelectorAll(selector)).toHaveLength(1);
  });

  it("does not use an attribute shared with another element", () => {
    setBody(`<ul><li data-testid="row">a</li><li data-testid="row">b</li></ul>`);
    const target = document.querySelectorAll("li")[1] as Element;
    const selector = buildSelector(target);
    expect(document.querySelectorAll(selector)).toHaveLength(1);
    expect(document.querySelector(selector)).toBe(target);
  });

  it("escapes quotes in attribute values", () => {
    setBody(`<button data-testid='a"b\\c'>x</button>`);
    const target = document.querySelector("button") as Element;
    expect(document.querySelector(buildSelector(target))).toBe(target);
  });

  it("always resolves to the body itself for the body", () => {
    expect(document.querySelector(buildSelector(document.body))).toBe(document.body);
  });
});

describe("describeElement", () => {
  it("lowercases the tag name", () => {
    setBody(`<BUTTON>x</BUTTON>`);
    expect(describeElement(document.querySelector("button") as Element).tagName).toBe("button");
  });

  it("normalises whitespace in the excerpt", () => {
    setBody(`<p>  un \n\n  deux  </p>`);
    expect(describeElement(document.querySelector("p") as Element).textExcerpt).toBe("un deux");
  });

  it("limits the excerpt to 120 code points without cutting an emoji", () => {
    setBody(`<p>${"👍".repeat(130)}</p>`);
    const { textExcerpt } = describeElement(document.querySelector("p") as Element);
    expect(Array.from(textExcerpt)).toHaveLength(120);
    expect(textExcerpt.isWellFormed()).toBe(true);
  });

  describe("form controls never expose their value (R13)", () => {
    it.each([
      [`<input aria-label="Nom" placeholder="p" name="n" value="secret" />`, "Nom"],
      [`<input placeholder="Votre nom" name="n" value="secret" />`, "Votre nom"],
      [`<input name="email" value="secret" />`, "email"],
      [`<input value="secret" />`, ""],
      [`<input type="password" aria-label="Mot de passe" value="secret" />`, "Mot de passe"],
      [`<textarea name="comment">secret</textarea>`, "comment"],
      [`<select name="pays"><option selected>secret</option></select>`, "pays"],
    ])("%s", (html, expected) => {
      setBody(html);
      const control = document.body.firstElementChild as Element;
      expect(describeElement(control).textExcerpt).toBe(expected);
    });

    it("excludes the values of the controls nested in a selected container", () => {
      setBody(`<form>Titre<textarea>secret</textarea><select><option>secret</option></select><input value="secret"/>Fin</form>`);
      expect(describeElement(document.querySelector("form") as Element).textExcerpt).toBe("Titre Fin");
    });
  });

  it("excludes scripts and styles", () => {
    setBody(`<div>Texte<script>secret()</script><style>.secret{}</style></div>`);
    expect(describeElement(document.querySelector("div") as Element).textExcerpt).toBe("Texte");
  });

  it("falls back on the accessible attributes of an element without text", () => {
    setBody(`<button aria-label="Fermer"><svg></svg></button><img alt="Logo" /><a title="Aide"></a>`);
    const [button, image, link] = Array.from(document.body.children) as Element[];
    expect(describeElement(button as Element).textExcerpt).toBe("Fermer");
    expect(describeElement(image as Element).textExcerpt).toBe("Logo");
    expect(describeElement(link as Element).textExcerpt).toBe("Aide");
  });
});

describe("createAnchor", () => {
  it("records the rectangle in document coordinates", () => {
    stubLayout({ left: 10, top: 20, width: 100, height: 40 });
    window.scrollX = 5;
    window.scrollY = 300;
    setBody(`<button id="save">Enregistrer</button>`);
    expect(createAnchor(byId("save"))).toEqual({
      selector: `[id="save"]`,
      tagName: "button",
      textExcerpt: "Enregistrer",
      rect: { x: 15, y: 320, width: 100, height: 40 },
    });
    window.scrollX = 0;
    window.scrollY = 0;
  });
});
