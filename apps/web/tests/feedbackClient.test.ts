import { afterEach, describe, expect, it, vi } from "vitest";
import { createFeedback, listFeedback } from "../src/api/feedbackClient.ts";

const ORIGIN = "https://app.example.com";

const stubFetch = (implementation: () => Promise<Response>) => {
  const fetchMock = vi.fn(implementation);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listFeedback", () => {
  it("requests the feedback of the origin", async () => {
    const fetchMock = stubFetch(async () => json(200, { items: [] }));
    await listFeedback(ORIGIN);
    expect(fetchMock).toHaveBeenCalledWith(`/api/feedback?origin=${encodeURIComponent(ORIGIN)}`);
  });

  it("returns the items on success", async () => {
    stubFetch(async () => json(200, { items: [] }));
    await expect(listFeedback(ORIGIN)).resolves.toEqual({ kind: "ok", items: [] });
  });

  it("reports a site outside the list on 403", async () => {
    stubFetch(async () => json(403, { code: "ORIGIN_NOT_ALLOWED" }));
    await expect(listFeedback(ORIGIN)).resolves.toEqual({ kind: "notAllowed" });
  });

  it("reports an error on 500", async () => {
    stubFetch(async () => json(500, { code: "INTERNAL_ERROR" }));
    await expect(listFeedback(ORIGIN)).resolves.toEqual({ kind: "error" });
  });

  it("reports an error when the network fails", async () => {
    stubFetch(async () => {
      throw new TypeError("network");
    });
    await expect(listFeedback(ORIGIN)).resolves.toEqual({ kind: "error" });
  });

  it("reports an error when the response does not match the schema", async () => {
    stubFetch(async () => json(200, { items: [{ id: "nope" }] }));
    await expect(listFeedback(ORIGIN)).resolves.toEqual({ kind: "error" });
  });

  it("reports an error when the response is not JSON", async () => {
    stubFetch(async () => new Response("<html>", { status: 200 }));
    await expect(listFeedback(ORIGIN)).resolves.toEqual({ kind: "error" });
  });
});

describe("createFeedback", () => {
  const request = {
    id: "3f2b8a51-2c1e-4d6f-9a3b-7e1c5d9f0a12",
    productOrigin: ORIGIN,
    pagePath: "/orders",
    body: "Retour",
    authorName: "Camille",
    anchor: { selector: "#a", tagName: "a", textExcerpt: "", rect: { x: 0, y: 0, width: 1, height: 1 } },
    displayContext: { viewportWidth: 800, viewportHeight: 600, scrollX: 0, scrollY: 0 },
  };
  const saved = { ...request, createdAt: "2026-11-04T10:00:00.000Z" };

  it("posts the request, with the provided id", async () => {
    const fetchMock = stubFetch(async () => json(201, saved));
    await createFeedback(request);
    expect(fetchMock).toHaveBeenCalledWith("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
  });

  it.each([201, 200])("returns the saved feedback on %i", async (status) => {
    stubFetch(async () => json(status, saved));
    await expect(createFeedback(request)).resolves.toEqual({ kind: "ok", feedback: saved });
  });

  it("reports the invalid fields on 400", async () => {
    stubFetch(async () => json(400, { code: "VALIDATION_ERROR", issues: [{ path: "body", code: "custom" }] }));
    await expect(createFeedback(request)).resolves.toEqual({ kind: "invalid", paths: ["body"] });
  });

  it("reports a site outside the list on 403", async () => {
    stubFetch(async () => json(403, { code: "ORIGIN_NOT_ALLOWED" }));
    await expect(createFeedback(request)).resolves.toEqual({ kind: "notAllowed" });
  });

  it("reports an error on 500", async () => {
    stubFetch(async () => json(500, { code: "INTERNAL_ERROR" }));
    await expect(createFeedback(request)).resolves.toEqual({ kind: "error" });
  });

  it("reports an error when the network fails", async () => {
    stubFetch(async () => {
      throw new TypeError("network");
    });
    await expect(createFeedback(request)).resolves.toEqual({ kind: "error" });
  });

  it("reports an error when the success response does not match the schema", async () => {
    stubFetch(async () => json(201, { id: "nope" }));
    await expect(createFeedback(request)).resolves.toEqual({ kind: "error" });
  });
});
