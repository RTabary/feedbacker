import { useId, type ReactNode } from "react";

export interface ControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

interface FieldProps {
  label: string;
  help?: ReactNode;
  error?: string | null;
  children: (controlProps: ControlProps) => ReactNode;
}

export const Field = ({ label, help, error, children }: FieldProps) => {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ");
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children({
        id,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(error ? { "aria-invalid": true as const } : {}),
      })}
      {help ? (
        <div className="field__help" id={helpId}>
          {help}
        </div>
      ) : null}
      {error ? (
        <div className="field__error" id={errorId}>
          {error}
        </div>
      ) : null}
    </div>
  );
};
