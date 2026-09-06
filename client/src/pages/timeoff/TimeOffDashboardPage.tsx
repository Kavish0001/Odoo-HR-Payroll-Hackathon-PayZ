import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useEmployees } from '../../api/employees.js';
import {
  useLeaveBalances,
  useTimeOffRequests,
  useTimeOffTypes,
} from '../../api/timeoff.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { Select } from '../../components/ui/Select.js';
import { useAuth } from '../../lib/auth.js';

import { formatQty } from './format.js';

/**
 * The Time Off dashboard the wireframe lists under the Time Off menu.
 *
 * Two questions, answered separately: what leave is left, and what is waiting
 * on somebody. Balances come from the same derivation the allocations list
 * uses, so the two screens cannot disagree about a number.
 */

export function TimeOffDashboardPage(): React.JSX.Element {
  const { user, allowed } = useAuth();
  const employeeId = user?.employeeId ?? undefined;

  const canApprove = allowed('approve', 'timeOffRequest');

  /**
   * Filters over the queue, not over the balances.
   *
   * Balances are four cards about one person and need no narrowing. The queue
   * is the part that grows: an approver looking at sixty-eight pending
   * requests wants the ones for a type, or a person, or wants to check what
   * was decided last week -- which is a different status, not a different
   * screen.
   */
  const [typeId, setTypeId] = useState('');
  const [queueEmployeeId, setQueueEmployeeId] = useState('');
  const [status, setStatus] = useState('TO_APPROVE');

  const typesQuery = useTimeOffTypes({ pageSize: 200, active: 'true' });
  const employeesQuery = useEmployees({ pageSize: 200 }, canApprove);

  const balances = useLeaveBalances(employeeId);
  // Anyone who can approve sees the queue; an employee sees only their own,
  // because the API scopes the same request to the caller (rule R2).
  const pending = useTimeOffRequests({
    pageSize: 50,
    ...(status === '' ? {} : { status }),
    ...(typeId === '' ? {} : { typeId }),
    ...(queueEmployeeId === '' ? {} : { employeeId: queueEmployeeId }),
  });

  const rows = balances.data ?? [];
  const queue = pending.data?.rows ?? [];
  const total = pending.data?.total ?? 0;

  const typeOptions = (typesQuery.data?.rows ?? []).map((t) => ({
    value: t.id,
    label: t.name,
  }));
  const employeeOptions = (employeesQuery.data?.rows ?? []).map((e) => ({
    value: e.id,
    label: e.fullName,
  }));
  const filtered =
    typeId !== '' || queueEmployeeId !== '' || status !== 'TO_APPROVE';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Time Off"
        subtitle="Your balance, and anything still waiting on a decision."
      />

      <section>
        <h2 className="eyebrow mb-3">My balances</h2>

        {balances.isLoading && (
          <div className="border-steel-300 bg-raised h-28 animate-pulse rounded-sm border" />
        )}

        {!balances.isLoading && rows.length === 0 && (
          <Card>
            <p className="text-sm">No leave types are allocated to you yet.</p>
            <p className="text-muted mt-1 text-xs">
              Balances appear once an approved allocation exists. Types that
              need no allocation, such as sick leave, never show one.
            </p>
          </Card>
        )}

        {rows.length > 0 && (
          <div className="border-steel-300 brushed divide-steel-300 grid grid-cols-1 divide-y rounded-sm border sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:divide-y-0">
            {rows.map((balance) => (
              <div key={balance.typeId} className="p-5">
                <span
                  aria-hidden="true"
                  className="metal-badge mb-4 block h-6 w-6"
                />
                <p className="eyebrow">{balance.typeName}</p>

                {balance.requiresAllocation ? (
                  <>
                    <p className="font-display mt-2 text-3xl font-bold tabular-nums">
                      {formatQty(balance.remaining, balance.unit)}
                    </p>
                    <span
                      aria-hidden="true"
                      className="bg-steel-300 mt-2 block h-[3px] w-24"
                    />
                    <p className="text-muted mt-3 text-xs">
                      {formatQty(balance.taken, balance.unit)} taken of{' '}
                      {formatQty(balance.allocated, balance.unit)}
                    </p>
                  </>
                ) : (
                  <>
                    {/* Rule T4: a type needing no allocation has no balance to
                        report, and N/A is honest where 0 would not be. */}
                    <p className="font-display text-muted mt-2 text-3xl font-bold">
                      N/A
                    </p>
                    <span
                      aria-hidden="true"
                      className="bg-steel-300 mt-2 block h-[3px] w-24"
                    />
                    <p className="text-muted mt-3 text-xs">
                      No allocation required
                    </p>
                  </>
                )}

                {balance.pending > 0 && (
                  <p className="text-muted mt-1 text-xs">
                    {formatQty(balance.pending, balance.unit)} awaiting approval
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="eyebrow">
            {canApprove ? 'Waiting on a decision' : 'My requests'}
          </h2>
          <span className="text-muted font-mono text-xs">
            {total} {status === 'TO_APPROVE' ? 'pending' : 'matching'}
          </span>
        </div>

        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Select
            aria-label="Filter the queue by status"
            className="max-w-44"
            options={[
              { value: 'TO_APPROVE', label: 'To approve' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'REFUSED', label: 'Refused' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ]}
            placeholder="All statuses"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
            }}
          />

          <Select
            aria-label="Filter the queue by time off type"
            className="max-w-48"
            options={typeOptions}
            placeholder="All types"
            value={typeId}
            onChange={(event) => {
              setTypeId(event.target.value);
            }}
          />

          {canApprove && (
            <Select
              aria-label="Filter the queue by employee"
              className="max-w-56"
              options={employeeOptions}
              placeholder="All employees"
              value={queueEmployeeId}
              onChange={(event) => {
                setQueueEmployeeId(event.target.value);
              }}
            />
          )}

          {filtered && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setStatus('TO_APPROVE');
                setTypeId('');
                setQueueEmployeeId('');
              }}
            >
              Reset
            </Button>
          )}
        </div>

        <Card className="p-0">
          {queue.length === 0 ? (
            <p className="text-muted p-5 text-sm">
              {filtered
                ? 'Nothing matches these filters.'
                : 'Nothing is waiting for approval.'}
            </p>
          ) : (
            <ul className="divide-steel-300 divide-y">
              {queue.slice(0, 8).map((request) => (
                <li key={request.id}>
                  <Link
                    to={`/time-off/requests/${request.id}`}
                    className="hover:bg-steel-100/50 flex items-center justify-between gap-4 px-5 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {request.employeeName}
                      </p>
                      <p className="text-muted font-mono mt-0.5 text-xs">
                        {request.typeName} &middot;{' '}
                        {request.startDate.slice(0, 10)}
                        {request.endDate !== request.startDate &&
                          ` to ${request.endDate.slice(0, 10)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs">
                        {formatQty(request.duration, request.unit)}
                      </span>
                      <StatusBadge status={request.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {queue.length > 8 && (
            <div className="border-steel-300 border-t px-5 py-3">
              <Link
                to="/time-off/requests?status=TO_APPROVE"
                className="eyebrow hover:text-ink"
              >
                View all {queue.length} pending &rarr;
              </Link>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
