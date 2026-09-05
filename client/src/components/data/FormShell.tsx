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
  /**
   * Renders the record without any way to change it: every control inside is
   * disabled and the Save/Discard footer is replaced by a note saying why.
   *
   * A role that cannot write should not be shown a form it can fill in and a
   * button that answers 403. Disabling is done with a `fieldset` rather than
   * per input, so a field added later is covered without anyone remembering
   * to cover it.
   */
  readOnly?: boolean;
  /** The sentence under a read-only form, e.g. who to ask for a change. */
  readOnlyNote?: string;
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
  readOnly = false,
  readOnlyNote,
}: FormShellProps): React.JSX.Element {
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {header}
      <Card className="p-5">
        {readOnly ? (
          // `contents` keeps the fieldset out of the layout, so the grid
          // inside lays out exactly as it does when editable.
          <fieldset disabled className="contents">
            {children}
          </fieldset>
        ) : (
          children
        )}
      </Card>

      {error !== null && error !== undefined && (
        <p
          role="alert"
          className="border-danger/30 bg-danger/5 text-danger rounded-sm border px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        {readOnly ? (
          <>
            <Button type="button" variant="secondary" onClick={onDiscard}>
              Back
            </Button>
            <p className="text-muted text-xs">
              {readOnlyNote ??
                'You can view this record but not change it. Ask an HR administrator if something here is wrong.'}
            </p>
          </>
        ) : (
          <>
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
          </>
        )}
        {footerExtra}
      </div>
    </form>
  );
}
