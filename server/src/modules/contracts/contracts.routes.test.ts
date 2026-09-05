import { describe, expect, it } from 'vitest';

import { displayedStatus } from './contracts.routes.js';

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

/**
 * Rule C4 has no sweep behind it: nothing writes EXPIRED when an end date
 * passes, so the derivation on read is the only thing keeping a lapsed
 * contract from being displayed as RUNNING. These exercise it directly,
 * since the seed happens to store the right status for most rows and would
 * hide a broken derivation behind data that already looks correct.
 */
describe('rule C4: a contract past its end date displays as EXPIRED', () => {
  it('expires a RUNNING contract whose end date is in the past', () => {
    expect(
      displayedStatus('RUNNING', day('2026-03-31'), day('2026-09-06')),
    ).toBe('EXPIRED');
  });

  it('leaves a RUNNING contract running on its own last day', () => {
    expect(
      displayedStatus('RUNNING', day('2026-09-06'), day('2026-09-06')),
    ).toBe('RUNNING');
  });

  it('leaves a RUNNING contract with a future end date alone', () => {
    expect(
      displayedStatus('RUNNING', day('2027-01-01'), day('2026-09-06')),
    ).toBe('RUNNING');
  });

  it('leaves an open-ended RUNNING contract alone', () => {
    expect(displayedStatus('RUNNING', null, day('2026-09-06'))).toBe('RUNNING');
  });

  it.each(['DRAFT', 'CANCELLED', 'EXPIRED'] as const)(
    'never rewrites a %s contract, whatever its dates say',
    (status) => {
      expect(
        displayedStatus(status, day('2026-03-31'), day('2026-09-06')),
      ).toBe(status);
    },
  );

  it('does not expire early for a server clock hours ahead of UTC midnight', () => {
    // The contract ends today; "now" is late evening in a +05:30 zone, which
    // is still the same UTC date. A timestamp comparison would have expired
    // it already.
    expect(
      displayedStatus(
        'RUNNING',
        day('2026-09-06'),
        new Date('2026-09-06T18:30:00.000Z'),
      ),
    ).toBe('RUNNING');
  });
});
