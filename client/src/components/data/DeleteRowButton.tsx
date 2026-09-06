import { useState, type MouseEvent } from 'react';

interface DeleteRowButtonProps {
  /** Names the thing in the confirmation, e.g. "CON/2026/0042". */
  label: string;
  onConfirm: () => void;
  isPending?: boolean;
  /** Why the row cannot be removed. Set means the icon is shown disabled. */
  disabledReason?: string | undefined;
}

/**
 * A delete affordance for a table row: an icon that asks before it acts.
 *
 * Deleting is the one action here with no undo, so it is deliberately two
 * clicks and the second one is labelled. The confirmation is inline rather
 * than a `window.confirm`, because a native dialog blocks the page and reads
 * as a browser interruption rather than as part of the row it belongs to.
 *
 * Rendering this at all is the caller's decision -- every use site is behind
 * `allowed('delete', resource)`, which the matrix puts at ADMIN for these
 * records. The API refuses regardless (rule R1); the icon's absence is a
 * courtesy, not the control.
 */
export function DeleteRowButton({
  label,
  onConfirm,
  isPending = false,
  disabledReason,
}: DeleteRowButtonProps): React.JSX.Element {
  const [confirming, setConfirming] = useState(false);
  const blocked = disabledReason !== undefined;

  // Rows are clickable and navigate to the record. Every button here has to
  // stop the event, or confirming a delete also opens the thing deleted.
  const stop = (event: MouseEvent): void => {
    event.stopPropagation();
  };

  if (blocked) {
    return (
      <span
        title={disabledReason}
        aria-label={disabledReason}
        className="text-steel-300 inline-flex cursor-not-allowed p-1"
        onClick={stop}
      >
        <TrashIcon />
      </span>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        title={`Delete ${label}`}
        aria-label={`Delete ${label}`}
        className="text-muted hover:text-danger hover:bg-danger-soft rounded-sm p-1 transition-colors"
        onClick={(event) => {
          stop(event);
          setConfirming(true);
        }}
      >
        <TrashIcon />
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1" onClick={stop}>
      <button
        type="button"
        className="border-danger-line bg-danger-soft text-danger font-mono rounded-sm border px-2 py-0.5 text-[11px] tracking-wider uppercase disabled:opacity-60"
        onClick={(event) => {
          stop(event);
          onConfirm();
        }}
        disabled={isPending}
      >
        {isPending ? 'Deleting…' : 'Delete'}
      </button>
      <button
        type="button"
        className="border-steel-300 text-muted hover:text-ink font-mono rounded-sm border px-2 py-0.5 text-[11px] tracking-wider uppercase"
        onClick={(event) => {
          stop(event);
          setConfirming(false);
        }}
        disabled={isPending}
      >
        Cancel
      </button>
    </span>
  );
}

/** 14px trash outline, drawn inline so the app pulls in no icon package. */
function TrashIcon(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
