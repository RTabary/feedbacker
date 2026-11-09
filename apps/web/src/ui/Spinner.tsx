interface SpinnerProps {
  label: string;
}

export const Spinner = ({ label }: SpinnerProps) => (
  <span role="status" aria-label={label} className="spinner">
    <span className="spinner__icon" aria-hidden="true" />
  </span>
);
