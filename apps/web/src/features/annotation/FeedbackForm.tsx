import { BODY_MAX_LENGTH, FeedbackBody, codePointLength } from "@feedbacker/contracts";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { t } from "../../i18n/t.ts";
import { Alert, Button, Field } from "../../ui/index.ts";

export type SubmitOutcome = "saved" | "failed" | "invalid" | "cancelled";

interface FeedbackFormProps {
  elementDescription: string;
  onSubmit: (body: string) => Promise<SubmitOutcome>;
  onCancel: () => void;
}

export const FeedbackForm = ({ elementDescription, onSubmit, onCancel }: FeedbackFormProps) => {
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const [body, setBody] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fieldRef.current?.focus();
  }, []);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const parsed = FeedbackBody.safeParse(body);
    if (!parsed.success) {
      setFieldError(
        codePointLength(body.trim()) === 0
          ? t("feedbackForm.bodyRequired")
          : t("feedbackForm.bodyTooLong", { max: BODY_MAX_LENGTH }),
      );
      fieldRef.current?.focus();
      return;
    }
    setFieldError(null);
    setOutcome(null);
    setSaving(true);
    const result = await onSubmit(parsed.data);
    setSaving(false);
    setOutcome(result);
  };

  return (
    <form className="feedback-form" noValidate onSubmit={(event) => void submit(event)}>
      <h2 className="panel__title">{t("feedbackForm.title")}</h2>
      <p className="feedback-form__element">
        <span className="feedback-form__element-label">{t("feedbackForm.element")}</span>
        <span>{elementDescription}</span>
      </p>
      <Field
        label={t("feedbackForm.bodyLabel")}
        help={t("common.characterCount", { count: codePointLength(body), max: BODY_MAX_LENGTH })}
        error={fieldError}
      >
        {(controlProps) => (
          <textarea
            {...controlProps}
            ref={fieldRef}
            rows={5}
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
            }}
          />
        )}
      </Field>
      {outcome === "failed" ? <Alert tone="error">{t("feedbackForm.saveFailed")}</Alert> : null}
      {outcome === "invalid" ? <Alert tone="error">{t("feedbackForm.invalid")}</Alert> : null}
      <div className="feedback-form__actions">
        <Button onClick={onCancel}>{t("common.cancel")}</Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {t("feedbackForm.submit")}
        </Button>
      </div>
    </form>
  );
};
