import type { Feedback } from "@feedbacker/contracts";
import { describe, expect, it } from "vitest";
import { buildMarkers, feedbackOrdinals } from "../src/features/feedback-list/markers.ts";
import { t } from "../src/i18n/t.ts";

const feedback = (id: string, pagePath: string, authorName = "Camille"): Feedback => ({
  id,
  productOrigin: "https://app.example.com",
  pagePath,
  body: "Retour",
  authorName,
  anchor: { selector: "#a", tagName: "a", textExcerpt: "", rect: { x: 0, y: 0, width: 1, height: 1 } },
  displayContext: { viewportWidth: 800, viewportHeight: 600, scrollX: 0, scrollY: 0 },
  createdAt: "2026-11-04T10:00:00.000Z",
});

const NEWEST = "00000000-0000-4000-8000-000000000003";
const MIDDLE = "00000000-0000-4000-8000-000000000002";
const OLDEST = "00000000-0000-4000-8000-000000000001";
const items = [feedback(NEWEST, "/a", "Alex"), feedback(MIDDLE, "/b"), feedback(OLDEST, "/a")];

describe("feedbackOrdinals", () => {
  it("numbers from the oldest, so that a number never changes when a feedback is added", () => {
    const ordinals = feedbackOrdinals(items);
    expect(ordinals.get(OLDEST)).toBe(1);
    expect(ordinals.get(MIDDLE)).toBe(2);
    expect(ordinals.get(NEWEST)).toBe(3);
  });
});

describe("buildMarkers", () => {
  it("only keeps the feedback of the current page, and labels it with the translated text", () => {
    const markers = buildMarkers(items, "/a");
    expect(markers.map((marker) => marker.feedbackId)).toEqual([NEWEST, OLDEST]);
    expect(markers[0]).toMatchObject({
      ordinal: 3,
      label: t("marker.label", { ordinal: 3, author: "Alex" }),
      anchor: items[0]?.anchor,
    });
  });

  it("gives no marker when the page has no feedback", () => {
    expect(buildMarkers(items, "/other")).toEqual([]);
  });
});
