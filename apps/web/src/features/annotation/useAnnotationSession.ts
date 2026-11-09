import type {
  Anchor,
  ConnectorToToolMessage,
  CursorDirection,
  DisplayContext,
  ToolToConnectorPayload,
} from "@feedbacker/contracts";
import { useCallback, useEffect, useState } from "react";
import { t } from "../../i18n/t.ts";
import type { ConnectionState } from "../product-frame/useProductConnection.ts";

export interface FeedbackDraft {
  /** Généré une fois par brouillon : une nouvelle tentative réutilise le même identifiant (R14). */
  id: string;
  anchor: Anchor;
  displayContext: DisplayContext;
  path: string;
  description: string;
}

export type AnnotationMode = "idle" | "picking" | "drafting";

interface Options {
  connectionState: ConnectionState;
  send: (payload: ToolToConnectorPayload) => void;
}

export const describeForAnnouncement = (tagName: string, textExcerpt: string): string =>
  textExcerpt
    ? t("annotation.cursor", { tag: tagName, excerpt: textExcerpt })
    : t("annotation.cursorNoText", { tag: tagName });

export const useAnnotationSession = ({ connectionState, send }: Options) => {
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<FeedbackDraft | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // Une nouvelle page ignore tout du mode annotation. Le brouillon, lui, vit dans l'outil et reste intact.
  useEffect(() => {
    if (connectionState !== "connected") setPicking(false);
  }, [connectionState]);

  const stopPicking = useCallback(() => {
    setPicking(false);
    setAnnouncement("");
    send({ type: "tool.setAnnotationMode", enabled: false });
  }, [send]);

  const toggle = useCallback(() => {
    if (connectionState !== "connected" || draft) return;
    if (picking) {
      stopPicking();
      return;
    }
    setPicking(true);
    send({ type: "tool.setAnnotationMode", enabled: true });
  }, [connectionState, draft, picking, send, stopPicking]);

  const move = useCallback(
    (direction: CursorDirection) => {
      send({ type: "tool.moveCursor", direction });
    },
    [send],
  );

  const confirm = useCallback(() => {
    send({ type: "tool.confirmCursor" });
  }, [send]);

  const closeDraft = useCallback(() => {
    setDraft(null);
    send({ type: "tool.clearSelection" });
  }, [send]);

  const handleMessage = useCallback(
    (message: ConnectorToToolMessage) => {
      switch (message.type) {
        case "connector.cursorMoved":
          setAnnouncement(describeForAnnouncement(message.tagName, message.textExcerpt));
          break;
        case "connector.elementSelected":
          stopPicking();
          setDraft({
            id: crypto.randomUUID(),
            anchor: message.anchor,
            displayContext: message.displayContext,
            path: message.path,
            description: describeForAnnouncement(message.anchor.tagName, message.anchor.textExcerpt),
          });
          break;
        case "connector.selectionCancelled":
          stopPicking();
          break;
        default:
          break;
      }
    },
    [stopPicking],
  );

  const mode: AnnotationMode = draft ? "drafting" : picking ? "picking" : "idle";

  return { mode, draft, announcement, toggle, move, confirm, cancel: stopPicking, closeDraft, handleMessage };
};
