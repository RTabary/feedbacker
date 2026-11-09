import * as z from "zod/mini";
import { Anchor, DisplayContext, PagePath, TEXT_EXCERPT_MAX_LENGTH } from "./feedback.ts";
import { safeText } from "./text.ts";

export const PROTOCOL_SOURCE = "feedbacker";
export const PROTOCOL_VERSION = 1;

const envelope = {
  source: z.literal(PROTOCOL_SOURCE),
  version: z.literal(PROTOCOL_VERSION),
};

export const AnchorStatus = z.enum(["exact", "approximate", "notFound"]);
export type AnchorStatus = z.infer<typeof AnchorStatus>;

export const CursorDirection = z.enum(["next", "previous", "parent", "child"]);
export type CursorDirection = z.infer<typeof CursorDirection>;

export const ConnectorToToolMessage = z.discriminatedUnion("type", [
  z.object({ ...envelope, type: z.literal("connector.hello") }),
  z.object({ ...envelope, type: z.literal("connector.ready"), path: PagePath }),
  z.object({ ...envelope, type: z.literal("connector.pageChanged"), path: PagePath }),
  z.object({
    ...envelope,
    type: z.literal("connector.cursorMoved"),
    tagName: safeText(64, 1),
    textExcerpt: safeText(TEXT_EXCERPT_MAX_LENGTH),
  }),
  z.object({
    ...envelope,
    type: z.literal("connector.elementSelected"),
    anchor: Anchor,
    displayContext: DisplayContext,
    path: PagePath,
  }),
  z.object({ ...envelope, type: z.literal("connector.selectionCancelled") }),
  z.object({ ...envelope, type: z.literal("connector.markerActivated"), feedbackId: z.uuid() }),
  z.object({
    ...envelope,
    type: z.literal("connector.markersResolved"),
    statuses: z.array(z.object({ feedbackId: z.uuid(), status: AnchorStatus })),
  }),
]);
export type ConnectorToToolMessage = z.infer<typeof ConnectorToToolMessage>;

export const Marker = z.object({
  feedbackId: z.uuid(),
  ordinal: z.int().check(z.gt(0)),
  label: safeText(300, 1),
  anchor: Anchor,
});
export type Marker = z.infer<typeof Marker>;

export const ToolToConnectorMessage = z.discriminatedUnion("type", [
  z.object({ ...envelope, type: z.literal("tool.ping") }),
  z.object({ ...envelope, type: z.literal("tool.setAnnotationMode"), enabled: z.boolean() }),
  z.object({ ...envelope, type: z.literal("tool.moveCursor"), direction: CursorDirection }),
  z.object({ ...envelope, type: z.literal("tool.confirmCursor") }),
  z.object({ ...envelope, type: z.literal("tool.clearSelection") }),
  z.object({
    ...envelope,
    type: z.literal("tool.setMarkers"),
    markers: z.array(Marker),
    activeFeedbackId: z.nullable(z.uuid()),
  }),
]);
export type ToolToConnectorMessage = z.infer<typeof ToolToConnectorMessage>;

type WithoutEnvelope<Message> = Message extends unknown ? Omit<Message, "source" | "version"> : never;
export type ConnectorToToolPayload = WithoutEnvelope<ConnectorToToolMessage>;
export type ToolToConnectorPayload = WithoutEnvelope<ToolToConnectorMessage>;

export const withEnvelope = <Payload extends object>(payload: Payload) => ({
  source: PROTOCOL_SOURCE,
  version: PROTOCOL_VERSION,
  ...payload,
});
