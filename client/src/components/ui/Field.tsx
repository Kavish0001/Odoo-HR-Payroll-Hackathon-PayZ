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
      <label htmlFor={htmlFor} className="eyebrow mb-1.5 block">
        {label}
        {required && <span className="text-signal"> *</span>}
      </label>
      {children}
      {error !== undefined ? (
        <p className="text-signal mt-1 text-xs">{error}</p>
      ) : hint !== undefined ? (
        <p className="text-muted mt-1 text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
