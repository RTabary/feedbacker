import type { AnchorStatus, Marker } from "@feedbacker/contracts";
import { resolveAnchor } from "./anchor.ts";
import type { Overlay } from "./overlay.ts";

const RETRY_INTERVAL_MS = 500;

export interface MarkerStatus {
  feedbackId: string;
  status: AnchorStatus;
}

interface Options {
  window: Window;
  overlay: Overlay;
  onStatuses: (statuses: MarkerStatus[]) => void;
}

export interface MarkerTracker {
  setMarkers: (markers: Marker[], activeFeedbackId: string | null) => void;
  stop: () => void;
}

interface Resolution {
  marker: Marker;
  status: AnchorStatus;
  element: Element | null;
}

/**
 * Garde les repères alignés sur l'état réel de la page : un contenu peut apparaître ou changer après le
 * chargement. Les boutons ne sont recréés que si cela est nécessaire, pour ne pas faire perdre le focus.
 */
export const createMarkerTracker = ({ window, overlay, onStatuses }: Options): MarkerTracker => {
  let markers: Marker[] = [];
  let activeId: string | null = null;
  let current: Resolution[] = [];
  let timer: number | null = null;

  const resolveAll = (): Resolution[] =>
    markers.map((marker) => ({ marker, ...resolveAnchor(window.document, marker.anchor) }));

  const sameMarkersDrawn = (next: Resolution[]): boolean =>
    next.length === current.length &&
    next.every((resolution, index) => {
      const previous = current[index];
      return (
        previous?.element === resolution.element &&
        previous.marker.feedbackId === resolution.marker.feedbackId &&
        previous.marker.ordinal === resolution.marker.ordinal &&
        previous.marker.label === resolution.marker.label
      );
    });

  const sameStatuses = (next: Resolution[]): boolean =>
    next.length === current.length && next.every((resolution, index) => current[index]?.status === resolution.status);

  const draw = (next: Resolution[]): void => {
    overlay.setMarkers(
      next.flatMap(({ marker, element }) =>
        element ? [{ feedbackId: marker.feedbackId, ordinal: marker.ordinal, label: marker.label, element }] : [],
      ),
    );
  };

  const applyActive = (next: Resolution[]): void => {
    overlay.setActive(next.find(({ marker }) => marker.feedbackId === activeId)?.element ?? null);
  };

  const report = (next: Resolution[]): void => {
    onStatuses(next.map(({ marker, status }) => ({ feedbackId: marker.feedbackId, status })));
  };

  const tick = (): void => {
    const next = resolveAll();
    const redraw = !sameMarkersDrawn(next);
    const changedStatuses = !sameStatuses(next);
    if (redraw) {
      draw(next);
      applyActive(next);
    }
    current = next;
    if (changedStatuses) report(next);
  };

  const stopTimer = (): void => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
  };

  return {
    setMarkers: (nextMarkers, nextActiveId) => {
      markers = nextMarkers;
      activeId = nextActiveId;
      const next = resolveAll();
      if (!sameMarkersDrawn(next)) draw(next);
      applyActive(next);
      current = next;
      report(next);
      if (markers.length === 0) stopTimer();
      else timer ??= window.setInterval(tick, RETRY_INTERVAL_MS);
    },
    stop: stopTimer,
  };
};
