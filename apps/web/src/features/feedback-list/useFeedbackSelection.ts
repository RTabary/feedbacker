import type { AnchorStatus, ConnectorToToolMessage, Feedback, ToolToConnectorPayload } from "@feedbacker/contracts";
import { useCallback, useEffect, useState } from "react";
import { buildMarkers } from "./markers.ts";

interface Options {
  items: Feedback[];
  currentPath: string | null;
  connected: boolean;
  send: (payload: ToolToConnectorPayload) => void;
  navigate: (path: string) => void;
}

const NO_STATUS: ReadonlyMap<string, AnchorStatus> = new Map();

export const useFeedbackSelection = ({ items, currentPath, connected, send, navigate }: Options) => {
  const [activeFeedbackId, setActiveFeedbackId] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<Feedback | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<Feedback | null>(null);
  const [statuses, setStatuses] = useState<ReadonlyMap<string, AnchorStatus>>(NO_STATUS);
  const [trackedPath, setTrackedPath] = useState(currentPath);

  // Ajustement pendant le rendu : aucun message n'est envoyé avec l'état de la page précédente.
  if (currentPath !== trackedPath) {
    setTrackedPath(currentPath);
    setStatuses(NO_STATUS);
    if (navigationTarget?.pagePath === currentPath) {
      setActiveFeedbackId(navigationTarget.id);
      setNavigationTarget(null);
    } else {
      setActiveFeedbackId(null);
    }
  }

  useEffect(() => {
    if (!connected || currentPath === null) return;
    send({ type: "tool.setMarkers", markers: buildMarkers(items, currentPath), activeFeedbackId });
  }, [activeFeedbackId, connected, currentPath, items, send]);

  const select = useCallback(
    (feedback: Feedback) => {
      if (feedback.pagePath === currentPath) setActiveFeedbackId(feedback.id);
      else setPendingNavigation(feedback);
    },
    [currentPath],
  );

  const confirmNavigation = useCallback(() => {
    if (!pendingNavigation) return;
    setNavigationTarget(pendingNavigation);
    setPendingNavigation(null);
    navigate(pendingNavigation.pagePath);
  }, [navigate, pendingNavigation]);

  const declineNavigation = useCallback(() => {
    setPendingNavigation(null);
  }, []);

  const handleMessage = useCallback((message: ConnectorToToolMessage) => {
    if (message.type === "connector.markerActivated") {
      setActiveFeedbackId(message.feedbackId);
    } else if (message.type === "connector.markersResolved") {
      setStatuses(new Map(message.statuses.map(({ feedbackId, status }) => [feedbackId, status])));
    }
  }, []);

  return { activeFeedbackId, pendingNavigation, statuses, select, confirmNavigation, declineNavigation, handleMessage };
};
