import { type ReactNode, type SubmitEvent } from 'react';

import { Button } from '../ui/Button.js';
import { Card } from '../ui/Card.js';

interface FormShellProps {
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  onDiscard: () => void;
  error?: string | null;
  children: ReactNode;
  /** Rendered above the card, outside the form padding (smart buttons, tabs). */
  header?: ReactNode;
  saveLabel?: string;
  disableSave?: boolean;
  footerExtra?: ReactNode;
}

/** Card + Save/Discard footer that every create/edit screen is built from. */
export function FormShell({
  onSubmit,
  isSubmitting,
  onDiscard,
  error,
  children,
  header,
  saveLabel = 'Save',
  disableSave = false,
  footerExtra,
}: FormShellProps): React.JSX.Element {
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {header}
      <Card className="p-5">{children}</Card>

      {error !== null && error !== undefined && (
        <p
          role="alert"
          className="border-danger/30 bg-danger/5 text-danger rounded-sm border px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSubmitting || disableSave}>
          {isSubmitting ? 'Saving…' : saveLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onDiscard}
          disabled={isSubmitting}
        >
          Discard
        </Button>
        {footerExtra}
      </div>
    </form>
  );
}
