import { describe, expect, it } from "vitest";
import { ConnectorToToolMessage, ToolToConnectorMessage } from "../src/protocol.ts";

const envelope = { source: "feedbacker", version: 1 } as const;
const anchor = { selector: "#a", tagName: "a", textExcerpt: "", rect: { x: 0, y: 0, width: 1, height: 1 } };
const displayContext = { viewportWidth: 800, viewportHeight: 600, scrollX: 0, scrollY: 0 };
const feedbackId = "3f2b8a51-2c1e-4d6f-9a3b-7e1c5d9f0a12";

describe("ConnectorToToolMessage", () => {
  it.each([
    [{ type: "connector.hello" }],
    [{ type: "connector.ready", path: "/" }],
    [{ type: "connector.pageChanged", path: "/orders" }],
    [{ type: "connector.cursorMoved", tagName: "button", textExcerpt: "Save" }],
    [{ type: "connector.elementSelected", anchor, displayContext, path: "/" }],
    [{ type: "connector.selectionCancelled" }],
    [{ type: "connector.markerActivated", feedbackId }],
    [{ type: "connector.markersResolved", statuses: [{ feedbackId, status: "exact" }] }],
    [{ type: "connector.markersResolved", statuses: [{ feedbackId, status: "approximate" }] }],
    [{ type: "connector.markersResolved", statuses: [{ feedbackId, status: "notFound" }] }],
  ])("accepts %j", (message) => {
    expect(ConnectorToToolMessage.safeParse({ ...envelope, ...message }).success).toBe(true);
  });

  it.each([
    [{ type: "connector.ready" }],
    [{ type: "connector.ready", path: "orders" }],
    [{ type: "connector.pageChanged", path: 1 }],
    [{ type: "connector.cursorMoved", tagName: "button" }],
    [{ type: "connector.elementSelected", anchor, path: "/" }],
    [{ type: "connector.markerActivated", feedbackId: "x" }],
    [{ type: "connector.markersResolved", statuses: [{ feedbackId, status: "unknown" }] }],
    [{ type: "tool.ping" }],
  ])("rejects %j", (message) => {
    expect(ConnectorToToolMessage.safeParse({ ...envelope, ...message }).success).toBe(false);
  });
});

describe("ToolToConnectorMessage", () => {
  const marker = { feedbackId, ordinal: 1, label: "Retour 1", anchor };

  it.each([
    [{ type: "tool.ping" }],
    [{ type: "tool.setAnnotationMode", enabled: true }],
    [{ type: "tool.moveCursor", direction: "next" }],
    [{ type: "tool.moveCursor", direction: "previous" }],
    [{ type: "tool.moveCursor", direction: "parent" }],
    [{ type: "tool.moveCursor", direction: "child" }],
    [{ type: "tool.confirmCursor" }],
    [{ type: "tool.clearSelection" }],
    [{ type: "tool.setMarkers", markers: [marker], activeFeedbackId: feedbackId }],
    [{ type: "tool.setMarkers", markers: [], activeFeedbackId: null }],
  ])("accepts %j", (message) => {
    expect(ToolToConnectorMessage.safeParse({ ...envelope, ...message }).success).toBe(true);
  });

  it.each([
    [{ type: "tool.setAnnotationMode" }],
    [{ type: "tool.moveCursor", direction: "up" }],
    [{ type: "tool.setMarkers", markers: [] }],
    [{ type: "tool.setMarkers", markers: [{ ...marker, ordinal: 0 }], activeFeedbackId: null }],
    [{ type: "connector.hello" }],
  ])("rejects %j", (message) => {
    expect(ToolToConnectorMessage.safeParse({ ...envelope, ...message }).success).toBe(false);
  });
});

describe("envelope", () => {
  it("rejects another source", () => {
    expect(ToolToConnectorMessage.safeParse({ source: "other", version: 1, type: "tool.ping" }).success).toBe(false);
  });
  it("rejects another version", () => {
    expect(ToolToConnectorMessage.safeParse({ source: "feedbacker", version: 2, type: "tool.ping" }).success).toBe(false);
  });
});
