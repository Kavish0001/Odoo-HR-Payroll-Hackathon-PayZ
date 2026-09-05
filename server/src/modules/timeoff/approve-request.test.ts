import { describe, expect, it } from 'vitest';

import { outsideAllocationWindow } from './approve-request.js';

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

/**
 * The approval transaction itself needs a database, but the refusal it
 * raises for rule T9 does not — and the refusal is the part that was wrong,
 * reporting a window mismatch as an exhausted balance.
 */
describe('rule T9: the refusal names the window, not the balance', () => {
  it('uses a code of its own so the client can tell the two refusals apart', () => {
    const error = outsideAllocationWindow([
      { validFrom: day('2026-01-01'), validTo: day('2026-06-30') },
    ]);

    expect(error.code).toBe('OUTSIDE_ALLOCATION_WINDOW');
    expect(error.code).not.toBe('INSUFFICIENT_BALANCE');
  });

  it('is a 422, like the balance refusal it sits beside', () => {
    const error = outsideAllocationWindow([
      { validFrom: day('2026-01-01'), validTo: day('2026-06-30') },
    ]);

    expect(error.status).toBe(422);
  });

  it('names the validity range that blocked the request', () => {
    const error = outsideAllocationWindow([
      { validFrom: day('2026-01-01'), validTo: day('2026-06-30') },
    ]);

    expect(error.message).toContain('2026-01-01 to 2026-06-30');
    expect(error.message).not.toContain('balance');
  });

  it('lists every allocation when the employee holds more than one', () => {
    const error = outsideAllocationWindow([
      { validFrom: day('2026-01-01'), validTo: day('2026-06-30') },
      { validFrom: day('2026-07-01'), validTo: day('2026-12-31') },
    ]);

    expect(error.message).toContain('2026-01-01 to 2026-06-30');
    expect(error.message).toContain('2026-07-01 to 2026-12-31');
  });

  it('spells out an open-ended allocation rather than printing null', () => {
    const error = outsideAllocationWindow([
      { validFrom: day('2026-07-01'), validTo: null },
    ]);

    expect(error.message).toContain('2026-07-01 to no end date');
  });
});
