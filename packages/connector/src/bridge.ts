import {
  ToolToConnectorMessage,
  withEnvelope,
  type ConnectorToToolPayload,
} from "@feedbacker/contracts";
import { createCursor } from "./cursor.ts";
import { createMarkerTracker, type MarkerTracker } from "./markerTracker.ts";
import { createOverlay, type Overlay } from "./overlay.ts";
import { createPageTracker } from "./pageTracker.ts";
import { createPicker, type Picker } from "./picker.ts";

export interface BridgeEnvironment {
  self: Window;
  parent: Window;
  toolOrigin: string;
}

interface Session {
  overlay: Overlay;
  picker: Picker;
  markerTracker: MarkerTracker;
  stopPageTracker: () => void;
}

/**
 * Pont entre le produit et l'outil. Hors iframe, il ne fait rien. Dans une iframe, il se limite à un
 * écouteur `message` et à un `connector.hello` tant qu'il n'a pas reçu de message vérifié (FR-006b).
 */
export const startBridge = ({ self, parent, toolOrigin }: BridgeEnvironment): (() => void) | null => {
  if (parent === self) return null;

  let session: Session | null = null;

  const send = (payload: ConnectorToToolPayload): void => {
    parent.postMessage(withEnvelope(payload), toolOrigin);
  };

  const activate = (): Session => {
    if (session) return session;
    const overlay = createOverlay(self.document, {
      onMarkerActivated: (feedbackId) => {
        send({ type: "connector.markerActivated", feedbackId });
      },
    });
    const picker = createPicker({
      window: self,
      overlay,
      cursor: createCursor(self.document),
      onCursorMoved: (description) => {
        send({ type: "connector.cursorMoved", ...description });
      },
      onSelected: (selection) => {
        send({ type: "connector.elementSelected", ...selection });
      },
      onCancelled: () => {
        send({ type: "connector.selectionCancelled" });
      },
    });
    const markerTracker = createMarkerTracker({
      window: self,
      overlay,
      onStatuses: (statuses) => {
        send({ type: "connector.markersResolved", statuses });
      },
    });
    const stopPageTracker = createPageTracker(self, (path) => {
      send({ type: "connector.pageChanged", path });
    });
    session = { overlay, picker, markerTracker, stopPageTracker };
    return session;
  };

  const onMessage = (event: MessageEvent): void => {
    if (event.source !== parent || event.origin !== toolOrigin) return;
    const parsed = ToolToConnectorMessage.safeParse(event.data);
    if (!parsed.success) return;
    const message = parsed.data;
    const { overlay, picker, markerTracker } = activate();
    switch (message.type) {
      case "tool.ping":
        send({ type: "connector.ready", path: self.location.pathname });
        break;
      case "tool.setAnnotationMode":
        if (message.enabled) picker.enable();
        else picker.disable();
        break;
      case "tool.moveCursor":
        picker.move(message.direction);
        break;
      case "tool.confirmCursor":
        picker.confirm();
        break;
      case "tool.clearSelection":
        overlay.setSelection(null);
        break;
      case "tool.setMarkers":
        markerTracker.setMarkers(message.markers, message.activeFeedbackId);
        break;
    }
  };

  self.addEventListener("message", onMessage);
  send({ type: "connector.hello" });

  return () => {
    self.removeEventListener("message", onMessage);
    session?.stopPageTracker();
    session?.markerTracker.stop();
    session?.picker.disable();
    session?.overlay.destroy();
    session = null;
  };
};
