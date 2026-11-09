import { useEffect, useId, useRef, type SyntheticEvent } from "react";
import { t } from "../../i18n/t.ts";
import { Button } from "../../ui/index.ts";

interface NavigationDialogProps {
  path: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const NavigationDialog = ({ path, onConfirm, onCancel }: NavigationDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);

  const cancelNatively = (event: SyntheticEvent): void => {
    event.preventDefault();
    onCancel();
  };

  return (
    <dialog ref={dialogRef} className="dialog" aria-labelledby={titleId} onCancel={cancelNatively}>
      <div className="dialog__form">
        <h2 className="dialog__title" id={titleId}>
          {t("feedbackList.navigation.title")}
        </h2>
        <p>{t("feedbackList.navigation.message", { path })}</p>
        <div className="dialog__actions">
          <Button onClick={onCancel}>{t("common.cancel")}</Button>
          <Button variant="primary" onClick={onConfirm}>
            {t("feedbackList.navigation.confirm")}
          </Button>
        </div>
      </div>
    </dialog>
  );
};
