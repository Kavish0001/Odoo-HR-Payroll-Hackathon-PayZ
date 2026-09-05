import { useEffect, useRef, useState } from 'react';

import {
  useAttendanceSession,
  useCheckIn,
  useCheckOut,
} from '../../api/attendance.js';
import { toApiError } from '../../api/client.js';
import { useAuth } from '../../lib/auth.js';
import { cn } from '../../lib/utils.js';
import { Button } from '../ui/Button.js';

function formatElapsed(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function ClockIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

/**
 * The navbar check-in clock (rule A5's widget path: every check-in through
 * here stamps `source: 'WIDGET'`).
 *
 * A red dot means no open session; green means one is running. Clicking
 * opens a popover offering the single action available in that state, with a
 * live-ticking elapsed counter derived from `checkInAt` on the client rather
 * than polled from the server every second.
 */
export function AttendanceWidget(): React.JSX.Element | null {
  const { user, allowed } = useAuth();
  const sessionQuery = useAttendanceSession();
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();

  const [open, setOpen] = useState(false);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const session = sessionQuery.data;
  const isOpenSession = session?.open === true;
  const checkInAt = session?.checkInAt ?? null;

  // Ticks the elapsed counter locally from the check-in timestamp, so the
  // popover updates every second without hitting the API on a timer.
  useEffect(() => {
    if (!isOpenSession || checkInAt === null) {
      setElapsedMinutes(0);
      return;
    }
    const checkInMs = new Date(checkInAt).getTime();
    const update = (): void => {
      setElapsedMinutes(
        Math.max(0, Math.floor((Date.now() - checkInMs) / 60_000)),
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [isOpenSession, checkInAt]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: MouseEvent): void {
      if (
        containerRef.current !== null &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open]);

  // Nothing to check in/out of for a caller who cannot see attendance at all,
  // or whose account carries no employee record.
  if (
    !allowed('read', 'attendance') ||
    user?.employeeId === null ||
    user?.employeeId === undefined
  ) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
        }}
        aria-label={
          isOpenSession
            ? 'Attendance: checked in'
            : 'Attendance: not checked in'
        }
        aria-expanded={open}
        className="border-line text-teal hover:bg-teal-soft relative rounded-md border p-2"
      >
        <ClockIcon />
        <span
          aria-hidden="true"
          className={cn(
            'ring-raised absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2',
            isOpenSession ? 'bg-success' : 'bg-danger',
          )}
        />
      </button>

      {open && (
        <div className="border-line bg-raised absolute right-0 z-30 mt-2 w-56 rounded-md border p-3 shadow-lg">
          {isOpenSession ? (
            <>
              <p className="text-muted text-xs font-medium tracking-wide uppercase">
                Checked in
              </p>
              <p className="font-mono mt-1 text-lg font-semibold">
                {formatElapsed(elapsedMinutes)}
              </p>
              <Button
                className="mt-3 w-full"
                variant="secondary"
                disabled={checkOutMutation.isPending}
                onClick={() => {
                  checkOutMutation.mutate(undefined, {
                    onSuccess: () => {
                      setOpen(false);
                    },
                  });
                }}
              >
                {checkOutMutation.isPending ? 'Checking out…' : 'Check Out'}
              </Button>
              {checkOutMutation.isError && (
                <p className="text-danger mt-1 text-xs">
                  {toApiError(checkOutMutation.error).message}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-muted text-xs">You are not checked in.</p>
              <Button
                className="mt-3 w-full"
                disabled={checkInMutation.isPending}
                onClick={() => {
                  checkInMutation.mutate(undefined, {
                    onSuccess: () => {
                      setOpen(false);
                    },
                  });
                }}
              >
                {checkInMutation.isPending ? 'Checking in…' : 'Check In'}
              </Button>
              {checkInMutation.isError && (
                <p className="text-danger mt-1 text-xs">
                  {toApiError(checkInMutation.error).message}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
