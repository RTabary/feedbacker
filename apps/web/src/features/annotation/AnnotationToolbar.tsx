import type { CursorDirection } from "@feedbacker/contracts";
import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { t } from "../../i18n/t.ts";
import { Button } from "../../ui/index.ts";

interface AnnotationToolbarProps {
  /** Le produit a répondu à l'outil : sans cela, l'annotation est impossible (FR-006a). */
  available: boolean;
  /** Un brouillon est en cours : l'annotation attend sa fermeture, sans autre explication. */
  busy?: boolean;
  picking: boolean;
  announcement: string;
  onToggle: () => void;
  onMove: (direction: CursorDirection) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const KEY_DIRECTIONS: Record<string, CursorDirection> = {
  ArrowRight: "next",
  ArrowLeft: "previous",
  ArrowUp: "parent",
  ArrowDown: "child",
};

export const AnnotationToolbar = ({
  available,
  busy = false,
  picking,
  announcement,
  onToggle,
  onMove,
  onConfirm,
  onCancel,
}: AnnotationToolbarProps) => {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const reasonId = useId();

  useEffect(() => {
    if (picking) toolbarRef.current?.focus();
  }, [picking]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const direction = KEY_DIRECTIONS[event.key];
    if (direction) {
      event.preventDefault();
      onMove(direction);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      toggleRef.current?.focus();
    } else if (event.key === "Enter" && event.target === event.currentTarget) {
      // Sur un bouton de la barre, Entrée active ce bouton ; seule la barre elle-même confirme.
      event.preventDefault();
      onConfirm();
    }
  };

  return (
    <div className="annotation">
      <div className="annotation__row">
        <Button
          ref={toggleRef}
          aria-pressed={picking}
          aria-describedby={available ? undefined : reasonId}
          disabled={!available || busy}
          onClick={onToggle}
        >
          {t("annotation.toggle")}
        </Button>
        {available ? null : (
          <span className="annotation__reason" id={reasonId}>
            {t("annotation.unavailable")}
          </span>
        )}
      </div>
      {picking ? (
        <div
          ref={toolbarRef}
          className="annotation__toolbar"
          role="toolbar"
          aria-label={t("annotation.toolbarLabel")}
          tabIndex={-1}
          onKeyDown={onKeyDown}
        >
          <p className="annotation__help">{t("annotation.help")}</p>
          <div className="annotation__buttons">
            <Button onClick={() => { onMove("previous"); }}>{t("annotation.previous")}</Button>
            <Button onClick={() => { onMove("next"); }}>{t("annotation.next")}</Button>
            <Button onClick={() => { onMove("parent"); }}>{t("annotation.parent")}</Button>
            <Button onClick={() => { onMove("child"); }}>{t("annotation.child")}</Button>
            <Button variant="primary" onClick={onConfirm}>
              {t("annotation.confirm")}
            </Button>
          </div>
        </div>
      ) : null}
      <div className="annotation__live" role="status" aria-live="polite" data-testid="annotation-announcement">
        {announcement}
      </div>
    </div>
  );
};
