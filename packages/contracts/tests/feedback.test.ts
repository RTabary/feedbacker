import { describe, expect, it } from "vitest";
import { Anchor, CreateFeedbackRequest, DisplayContext, ProductOrigin } from "../src/feedback.ts";

const validAnchor = {
  selector: "#save",
  tagName: "button",
  textExcerpt: "Save",
  rect: { x: 1, y: 2, width: 3, height: 4 },
};
const validContext = { viewportWidth: 1280, viewportHeight: 720, scrollX: 0, scrollY: 12.5 };
const validRequest = {
  id: "3f2b8a51-2c1e-4d6f-9a3b-7e1c5d9f0a12",
  productOrigin: "https://app.example.com",
  pagePath: "/orders",
  body: "Le libellé est ambigu",
  authorName: "Camille",
  anchor: validAnchor,
  displayContext: validContext,
};

const parse = (override: Record<string, unknown>) =>
  CreateFeedbackRequest.safeParse({ ...validRequest, ...override });

describe("CreateFeedbackRequest", () => {
  it("accepts a valid request", () => {
    expect(parse({}).success).toBe(true);
  });

  describe("body", () => {
    it("trims leading and trailing whitespace", () => {
      const result = parse({ body: "  Bonjour \n" });
      expect(result.success && result.data.body).toBe("Bonjour");
    });
    it("is required once trimmed", () => {
      expect(parse({ body: "   " }).success).toBe(false);
    });
    it("is limited to 5000 characters", () => {
      expect(parse({ body: "a".repeat(5000) }).success).toBe(true);
      expect(parse({ body: "a".repeat(5001) }).success).toBe(false);
    });
    it("refuses NUL and isolated surrogates", () => {
      expect(parse({ body: "a\u0000" }).success).toBe(false);
      expect(parse({ body: "a\ud83d" }).success).toBe(false);
    });
  });

  describe("authorName", () => {
    it("trims and requires 1 to 100 characters", () => {
      const result = parse({ authorName: "  Camille " });
      expect(result.success && result.data.authorName).toBe("Camille");
      expect(parse({ authorName: "  " }).success).toBe(false);
      expect(parse({ authorName: "a".repeat(100) }).success).toBe(true);
      expect(parse({ authorName: "a".repeat(101) }).success).toBe(false);
    });
  });

  describe("pagePath", () => {
    it("starts with a slash and is at most 2048 characters", () => {
      expect(parse({ pagePath: "orders" }).success).toBe(false);
      expect(parse({ pagePath: `/${"a".repeat(2047)}` }).success).toBe(true);
      expect(parse({ pagePath: `/${"a".repeat(2048)}` }).success).toBe(false);
    });
  });

  describe("id", () => {
    it("is a valid UUID", () => {
      expect(parse({ id: "not-a-uuid" }).success).toBe(false);
    });
  });
});

describe("ProductOrigin", () => {
  it.each(["https://app.example.com", "http://app.example.com:8080"])("accepts %s", (origin) => {
    expect(ProductOrigin.safeParse(origin).success).toBe(true);
  });

  it.each([
    "https://app.example.com/",
    "https://app.example.com/path",
    "HTTPS://APP.example.com",
    "https://app.example.com:443",
    "javascript:alert(1)",
    "ftp://app.example.com",
    "file:///etc/passwd",
    "null",
    "",
    "https://*.example.com",
    "https://a;b.example.com",
  ])("rejects %s", (origin) => {
    expect(ProductOrigin.safeParse(origin).success).toBe(false);
  });
});

describe("Anchor", () => {
  const parseAnchor = (override: Record<string, unknown>) =>
    Anchor.safeParse({ ...validAnchor, ...override });

  it("accepts a valid anchor", () => {
    expect(parseAnchor({}).success).toBe(true);
  });
  it("requires a selector of 1 to 4000 characters", () => {
    expect(parseAnchor({ selector: "" }).success).toBe(false);
    expect(parseAnchor({ selector: "a".repeat(4000) }).success).toBe(true);
    expect(parseAnchor({ selector: "a".repeat(4001) }).success).toBe(false);
  });
  it("requires a lowercase tagName of 1 to 64 characters", () => {
    expect(parseAnchor({ tagName: "" }).success).toBe(false);
    expect(parseAnchor({ tagName: "BUTTON" }).success).toBe(false);
    expect(parseAnchor({ tagName: "a".repeat(65) }).success).toBe(false);
  });
  it("limits textExcerpt to 120 characters and allows it to be empty", () => {
    expect(parseAnchor({ textExcerpt: "" }).success).toBe(true);
    expect(parseAnchor({ textExcerpt: "a".repeat(120) }).success).toBe(true);
    expect(parseAnchor({ textExcerpt: "a".repeat(121) }).success).toBe(false);
  });
  it("requires a finite rect with non-negative width and height", () => {
    expect(parseAnchor({ rect: { ...validAnchor.rect, x: Number.POSITIVE_INFINITY } }).success).toBe(false);
    expect(parseAnchor({ rect: { ...validAnchor.rect, width: -1 } }).success).toBe(false);
    expect(parseAnchor({ rect: { ...validAnchor.rect, height: -1 } }).success).toBe(false);
    expect(parseAnchor({ rect: { ...validAnchor.rect, x: -5 } }).success).toBe(true);
  });
});

describe("DisplayContext", () => {
  const parseContext = (override: Record<string, unknown>) =>
    DisplayContext.safeParse({ ...validContext, ...override });

  it("requires positive integer viewport dimensions", () => {
    expect(parseContext({ viewportWidth: 0 }).success).toBe(false);
    expect(parseContext({ viewportHeight: 10.5 }).success).toBe(false);
  });
  it("requires finite scroll positions", () => {
    expect(parseContext({ scrollX: Number.NaN }).success).toBe(false);
    expect(parseContext({ scrollY: Number.POSITIVE_INFINITY }).success).toBe(false);
  });
});
