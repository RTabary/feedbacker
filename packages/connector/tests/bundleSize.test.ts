// @vitest-environment node
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "vite";
import { describe, expect, it } from "vitest";

const MAX_GZIP_BYTES = 25 * 1024;
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("connector bundle", () => {
  it("stays under 25 KiB once compressed (R10)", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "feedbacker-connector-"));
    await build({ root: packageRoot, logLevel: "silent", build: { outDir, emptyOutDir: false } });
    const size = gzipSync(readFileSync(join(outDir, "connector.js"))).length;
    expect(size).toBeLessThanOrEqual(MAX_GZIP_BYTES);
  }, 60_000);
});
