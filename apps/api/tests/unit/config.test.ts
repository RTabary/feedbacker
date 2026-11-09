import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.ts";

const valid = {
  DATABASE_URL: "postgres://user:s3cret@db.internal:5432/feedbacker",
  ALLOWED_PRODUCT_ORIGINS: "https://app.example.com,https://rec.example.com",
};

describe("loadConfig", () => {
  it("parses a valid environment", () => {
    expect(loadConfig({ ...valid, PORT: "4000" })).toEqual({
      databaseUrl: valid.DATABASE_URL,
      allowedOrigins: ["https://app.example.com", "https://rec.example.com"],
      port: 4000,
    });
  });

  it("defaults PORT to 3000", () => {
    expect(loadConfig(valid).port).toBe(3000);
  });

  it("tolerates spaces around origins", () => {
    expect(loadConfig({ ...valid, ALLOWED_PRODUCT_ORIGINS: " https://a.example.com , https://b.example.com " }).allowedOrigins)
      .toEqual(["https://a.example.com", "https://b.example.com"]);
  });

  it("requires DATABASE_URL", () => {
    expect(() => loadConfig({ ALLOWED_PRODUCT_ORIGINS: valid.ALLOWED_PRODUCT_ORIGINS })).toThrow(/DATABASE_URL/);
  });

  it("rejects a DATABASE_URL that is not PostgreSQL", () => {
    expect(() => loadConfig({ ...valid, DATABASE_URL: "mysql://x" })).toThrow(/DATABASE_URL/);
  });

  it("requires at least one allowed origin", () => {
    expect(() => loadConfig({ ...valid, ALLOWED_PRODUCT_ORIGINS: "" })).toThrow(/ALLOWED_PRODUCT_ORIGINS/);
    expect(() => loadConfig({ DATABASE_URL: valid.DATABASE_URL })).toThrow(/ALLOWED_PRODUCT_ORIGINS/);
  });

  it.each(["https://*.example.com", "https://app.example.com/path", "https://app.example.com/", "app.example.com", "*"])(
    "rejects the non-canonical origin %s",
    (origin) => {
      expect(() => loadConfig({ ...valid, ALLOWED_PRODUCT_ORIGINS: origin })).toThrow(/ALLOWED_PRODUCT_ORIGINS/);
    },
  );

  it("rejects an invalid PORT", () => {
    expect(() => loadConfig({ ...valid, PORT: "abc" })).toThrow(/PORT/);
  });

  it("never prints the value of DATABASE_URL in an error", () => {
    expect.assertions(1);
    try {
      loadConfig({ ...valid, ALLOWED_PRODUCT_ORIGINS: "" });
    } catch (error) {
      expect(String(error)).not.toContain("s3cret");
    }
  });

  it("does not print a malformed DATABASE_URL either", () => {
    expect.assertions(1);
    try {
      loadConfig({ ...valid, DATABASE_URL: "s3cret-not-a-url" });
    } catch (error) {
      expect(String(error)).not.toContain("s3cret");
    }
  });
});
