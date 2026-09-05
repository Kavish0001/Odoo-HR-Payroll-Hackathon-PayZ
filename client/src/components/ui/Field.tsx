import { type ReactNode } from 'react';

interface FieldProps {
  label: string;
  htmlFor?: string | undefined;
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean | undefined;
  children: ReactNode;
  className?: string | undefined;
}

/** Label + control + error/hint, the row unit every form in the app is built from. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
  className,
}: FieldProps): React.JSX.Element {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="text-muted mb-1 block text-xs font-medium tracking-wide uppercase"
      >
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error !== undefined ? (
        <p className="text-danger mt-1 text-xs">{error}</p>
      ) : hint !== undefined ? (
        <p className="text-muted mt-1 text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
