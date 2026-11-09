import { describe, expect, it } from "vitest";
import { parseProductUrl } from "../src/features/product-frame/productUrl.ts";

const parse = (url: string) => parseProductUrl(`?url=${encodeURIComponent(url)}`);

describe("parseProductUrl", () => {
  it("reports a missing parameter", () => {
    expect(parseProductUrl("")).toEqual({ kind: "missing" });
    expect(parseProductUrl("?other=1")).toEqual({ kind: "missing" });
    expect(parseProductUrl("?url=")).toEqual({ kind: "missing" });
  });

  it.each(["not a url", "javascript:alert(1)", "data:text/html,<p>x</p>", "file:///etc/passwd", "ftp://app.example.com/", "//app.example.com", "about:blank"])(
    "refuses %s",
    (url) => {
      expect(parse(url)).toEqual({ kind: "invalid" });
    },
  );

  it("refuses credentials in the address, which could disguise the real site", () => {
    expect(parse("https://user:pass@app.example.com/")).toEqual({ kind: "invalid" });
  });

  it("accepts http and https", () => {
    expect(parse("https://app.example.com/orders?id=1#top")).toEqual({
      kind: "valid",
      url: "https://app.example.com/orders?id=1#top",
      origin: "https://app.example.com",
    });
    expect(parse("http://app.example.com:8080/").kind).toBe("valid");
  });

  it("extracts the canonical origin", () => {
    const result = parse("HTTPS://APP.Example.com:443/Path");
    expect(result).toEqual({ kind: "valid", url: "https://app.example.com/Path", origin: "https://app.example.com" });
  });
});
