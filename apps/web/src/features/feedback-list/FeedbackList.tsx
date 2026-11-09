import type { AnchorStatus, Feedback } from "@feedbacker/contracts";
import { useEffect, useRef } from "react";
import { formatDateTime, t } from "../../i18n/t.ts";
import { Alert, Button, Spinner } from "../../ui/index.ts";
import { describeForAnnouncement } from "../annotation/useAnnotationSession.ts";
import { feedbackOrdinals } from "./markers.ts";
import type { FeedbackListState } from "./useFeedbackList.ts";

interface FeedbackListProps {
  state: FeedbackListState;
  /** Page affichée par le produit ; inconnue si le connecteur n'a pas répondu. */
  currentPath: string | null;
  statuses: ReadonlyMap<string, AnchorStatus>;
  activeFeedbackId: string | null;
  onSelect: (feedback: Feedback) => void;
  onRetry: () => void;
}

interface FeedbackItemProps {
  feedback: Feedback;
  ordinal: number;
  onCurrentPage: boolean;
  status: AnchorStatus | undefined;
  active: boolean;
  onSelect: (feedback: Feedback) => void;
}

const FeedbackItem = ({ feedback, ordinal, onCurrentPage, status, active, onSelect }: FeedbackItemProps) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (active) buttonRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <li>
      <Button
        ref={buttonRef}
        className="feedback-item"
        aria-current={active ? "true" : undefined}
        onClick={() => {
          onSelect(feedback);
        }}
      >
        <span className="feedback-item__header">
          <span>{ordinal}</span>
          <span>
            {onCurrentPage ? t("feedbackList.onThisPage") : t("feedbackList.onPage", { path: feedback.pagePath })}
          </span>
        </span>
        <span>{feedback.body}</span>
        <span className="feedback-item__meta">
          {t("feedbackList.byline", { author: feedback.authorName, date: formatDateTime(feedback.createdAt) })}
        </span>
        <span className="feedback-item__meta">
          {t("feedbackList.element", {
            description: describeForAnnouncement(feedback.anchor.tagName, feedback.anchor.textExcerpt),
          })}
        </span>
        {onCurrentPage && status === "approximate" ? (
          <span className="feedback-item__warning">{t("feedbackList.approximate")}</span>
        ) : null}
        {onCurrentPage && status === "notFound" ? (
          <span className="feedback-item__warning">{t("feedbackList.notFound")}</span>
        ) : null}
      </Button>
    </li>
  );
};

export const FeedbackList = ({ state, currentPath, statuses, activeFeedbackId, onSelect, onRetry }: FeedbackListProps) => {
  if (state.status === "loading") return <Spinner label={t("common.loading")} />;
  if (state.status !== "ready") {
    return (
      <section className="feedback-list">
        <h2 className="panel__title">{t("feedbackList.title")}</h2>
        <Alert tone="error">{t("feedbackList.loadFailed")}</Alert>
        <div>
          <Button onClick={onRetry}>{t("common.retry")}</Button>
        </div>
      </section>
    );
  }
  const ordinals = feedbackOrdinals(state.items);
  return (
    <section className="feedback-list">
      <h2 className="panel__title">{t("feedbackList.count", { count: state.items.length })}</h2>
      {state.items.length === 0 ? (
        <p>{t("feedbackList.empty")}</p>
      ) : (
        <ul className="feedback-list__items" aria-label={t("feedbackList.label")}>
          {state.items.map((feedback) => (
            <FeedbackItem
              key={feedback.id}
              feedback={feedback}
              ordinal={ordinals.get(feedback.id) ?? 0}
              onCurrentPage={feedback.pagePath === currentPath}
              status={statuses.get(feedback.id)}
              active={feedback.id === activeFeedbackId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </section>
  );
};
