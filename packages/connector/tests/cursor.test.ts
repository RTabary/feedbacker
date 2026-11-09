import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCursor } from "../src/cursor.ts";
import { byId, setBody, stubLayout, stubScrollIntoView } from "./helpers/dom.ts";

describe("createCursor", () => {
  let scrollIntoView: ReturnType<typeof stubScrollIntoView>;

  beforeEach(() => {
    stubLayout();
    scrollIntoView = stubScrollIntoView();
    setBody(`
      <section id="a">
        <p id="a1"><span id="a1x">x</span></p>
        <p id="a2">y</p>
      </section>
      <script id="ignored-script"></script>
      <div id="hidden" style="display:none"><span id="hidden-child">z</span></div>
      <button id="b">b</button>
    `);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("has no current element at first", () => {
    expect(createCursor(document).current()).toBeNull();
  });

  it("starts on the first element when nothing has the focus", () => {
    expect(createCursor(document).move("next")).toBe(byId("a"));
  });

  it("starts from the focused element", () => {
    byId("b").focus();
    const cursor = createCursor(document);
    cursor.move("next");
    expect(cursor.current()).toBe(byId("b"));
  });

  it("walks through the document order", () => {
    const cursor = createCursor(document);
    cursor.set(byId("a"));
    expect(cursor.move("next")).toBe(byId("a1"));
    expect(cursor.move("next")).toBe(byId("a1x"));
    expect(cursor.move("next")).toBe(byId("a2"));
    expect(cursor.move("previous")).toBe(byId("a1x"));
    expect(cursor.move("previous")).toBe(byId("a1"));
  });

  it("skips scripts, hidden subtrees and elements without size", () => {
    const cursor = createCursor(document);
    cursor.set(byId("a2"));
    expect(cursor.move("next")).toBe(byId("b"));
  });

  it("skips an element with zero size but visits its children", () => {
    vi.restoreAllMocks();
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const width = this.id === "a1" ? 0 : 100;
      return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: 10, width, height: 10, toJSON: () => ({}) };
    });
    const cursor = createCursor(document);
    cursor.set(byId("a"));
    expect(cursor.move("next")).toBe(byId("a1x"));
  });

  it("goes to the parent then back to a child", () => {
    const cursor = createCursor(document);
    cursor.set(byId("a1x"));
    expect(cursor.move("parent")).toBe(byId("a1"));
    expect(cursor.move("parent")).toBe(byId("a"));
    expect(cursor.move("child")).toBe(byId("a1"));
    expect(cursor.move("child")).toBe(byId("a1x"));
  });

  it("stays in place at the boundaries, without error", () => {
    const cursor = createCursor(document);
    cursor.set(byId("a"));
    expect(cursor.move("parent")).toBe(byId("a"));
    cursor.set(byId("a2"));
    expect(cursor.move("child")).toBe(byId("a2"));
    cursor.set(byId("b"));
    expect(cursor.move("next")).toBe(byId("b"));
    cursor.set(byId("a"));
    expect(cursor.move("previous")).toBe(byId("a"));
  });

  it("brings the element into view", () => {
    const cursor = createCursor(document);
    cursor.set(byId("a"));
    cursor.move("next");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
  });

  it("restarts from the document when the current element was removed", () => {
    const cursor = createCursor(document);
    cursor.set(byId("a2"));
    byId("a2").remove();
    expect(cursor.move("next")).toBe(byId("a"));
  });

  it("ignores the overlay of the connector", () => {
    const host = document.createElement("div");
    host.dataset.feedbackerOverlay = "";
    document.body.append(host);
    const cursor = createCursor(document);
    cursor.set(byId("b"));
    expect(cursor.move("next")).toBe(byId("b"));
  });
});
