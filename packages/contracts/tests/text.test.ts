import { describe, expect, it } from "vitest";
import { safeText } from "../src/text.ts";

describe("safeText", () => {
  const schema = safeText(10);

  it("accepts accents and emojis", () => {
    expect(schema.safeParse("été 👍").success).toBe(true);
  });

  it("accepts an empty string by default", () => {
    expect(schema.safeParse("").success).toBe(true);
  });

  it("rejects the NUL character that PostgreSQL refuses", () => {
    expect(schema.safeParse("a\u0000b").success).toBe(false);
  });

  it("rejects an isolated surrogate", () => {
    expect(schema.safeParse("a\ud83d").success).toBe(false);
  });

  it("counts an emoji as one character, like PostgreSQL does", () => {
    expect(schema.safeParse("👍".repeat(10)).success).toBe(true);
    expect(schema.safeParse("👍".repeat(11)).success).toBe(false);
  });

  it("rejects a string longer than the maximum", () => {
    expect(schema.safeParse("a".repeat(11)).success).toBe(false);
    expect(schema.safeParse("a".repeat(10)).success).toBe(true);
  });
});
