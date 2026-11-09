import { AUTHOR_NAME_MAX_LENGTH, AuthorName, codePointLength } from "@feedbacker/contracts";
import { useEffect, useId, useRef, useState, type FormEvent, type SyntheticEvent } from "react";
import { t } from "../../i18n/t.ts";
import { Button, Field } from "../../ui/index.ts";

interface AuthorDialogProps {
  open: boolean;
  initialName: string | null;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

export const AuthorDialog = ({ open, initialName, onSubmit, onCancel }: AuthorDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();
  const [value, setValue] = useState(initialName ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    setValue(initialName ?? "");
    setError(null);
    dialog.showModal();
    inputRef.current?.focus();
    return () => {
      dialog.close();
    };
  }, [initialName, open]);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const parsed = AuthorName.safeParse(value);
    if (parsed.success) {
      onSubmit(parsed.data);
      return;
    }
    setError(
      codePointLength(value.trim()) === 0
        ? t("author.nameRequired")
        : t("author.nameTooLong", { max: AUTHOR_NAME_MAX_LENGTH }),
    );
    inputRef.current?.focus();
  };

  const cancelNatively = (event: SyntheticEvent): void => {
    event.preventDefault();
    onCancel();
  };

  return (
    <dialog ref={dialogRef} className="dialog" aria-labelledby={titleId} onCancel={cancelNatively}>
      <form className="dialog__form" noValidate onSubmit={submit}>
        <h2 className="dialog__title" id={titleId}>
          {t("author.title")}
        </h2>
        <Field label={t("author.nameLabel")} help={t("author.help")} error={error}>
          {(controlProps) => (
            <input
              {...controlProps}
              ref={inputRef}
              type="text"
              autoComplete="name"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
              }}
            />
          )}
        </Field>
        <div className="dialog__actions">
          <Button onClick={onCancel}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary">
            {t("author.save")}
          </Button>
        </div>
      </form>
    </dialog>
  );
};
