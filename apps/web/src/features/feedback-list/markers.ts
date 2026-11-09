import type { Feedback, Marker } from "@feedbacker/contracts";
import { t } from "../../i18n/t.ts";

/** La liste arrive du plus récent au plus ancien ; le numéro part du plus ancien pour rester stable. */
export const feedbackOrdinals = (items: Feedback[]): Map<string, number> =>
  new Map(items.map((item, index) => [item.id, items.length - index]));

export const buildMarkers = (items: Feedback[], path: string): Marker[] => {
  const ordinals = feedbackOrdinals(items);
  return items.flatMap((item) => {
    const ordinal = ordinals.get(item.id);
    if (item.pagePath !== path || ordinal === undefined) return [];
    return [
      {
        feedbackId: item.id,
        ordinal,
        label: t("marker.label", { ordinal, author: item.authorName }),
        anchor: item.anchor,
      },
    ];
  });
};
