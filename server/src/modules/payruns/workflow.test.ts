import { type PayrunStatus } from '@payz/shared';
import { describe, expect, it } from 'vitest';

import {
  canValidatePayrun,
  ensureComputable,
  ensureLegalTransition,
  ensureNotLocked,
  ensureSendable,
  unresolvedWarningReasons,
} from './workflow-guard.js';

/**
 * Rules W4, W5, W6, W8: the payrun state machine and the warning gate that
 * guards Validate. These wrap `shared/src/workflow.ts` rather than
 * reimplementing it, so what's under test here is that the API turns those
 * booleans into the right 409s and the right validate/acknowledge gating —
 * not the state machine itself, which shared already tests.
 */

describe('ensureLegalTransition', () => {
  it('allows every documented legal transition without throwing', () => {
    const legal: [from: PayrunStatus, to: PayrunStatus][] = [
      ['DRAFT', 'COMPUTED'],
      ['DRAFT', 'CANCELLED'],
      ['COMPUTED', 'COMPUTED'],
      ['COMPUTED', 'VALIDATED'],
      ['COMPUTED', 'DRAFT'],
      ['COMPUTED', 'CANCELLED'],
      ['VALIDATED', 'PAID'],
      ['VALIDATED', 'CANCELLED'],
    ];

    for (const [from, to] of legal) {
      expect(() => {
        ensureLegalTransition(from, to);
      }).not.toThrow();
    }
  });

  it('rejects an illegal transition with a 409 naming the legal options', () => {
    expect(() => {
      ensureLegalTransition('DRAFT', 'VALIDATED');
    }).toThrow(/Legal next states: COMPUTED, CANCELLED/);
  });

  it('rejects any transition out of a terminal PAID payrun', () => {
    expect(() => {
      ensureLegalTransition('PAID', 'CANCELLED');
    }).toThrow(/final and cannot change state/);
  });

  it('rejects any transition out of a terminal CANCELLED payrun', () => {
    expect(() => {
      ensureLegalTransition('CANCELLED', 'DRAFT');
    }).toThrow(/final and cannot change state/);
  });

  it('carries the status code as 409 on the thrown error', () => {
    try {
      ensureLegalTransition('DRAFT', 'PAID');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as { status: number }).status).toBe(409);
    }
  });
});

describe('ensureComputable', () => {
  it('allows compute from DRAFT and COMPUTED', () => {
    expect(() => {
      ensureComputable('DRAFT');
    }).not.toThrow();
    expect(() => {
      ensureComputable('COMPUTED');
    }).not.toThrow();
  });

  it('rejects compute once a payrun is validated or paid (rule W5)', () => {
    expect(() => {
      ensureComputable('VALIDATED');
    }).toThrow(/Cannot compute a VALIDATED payrun/);
    expect(() => {
      ensureComputable('PAID');
    }).toThrow(/Cannot compute a PAID payrun/);
  });

  it('rejects compute on a cancelled payrun', () => {
    expect(() => {
      ensureComputable('CANCELLED');
    }).toThrow();
  });
});

describe('ensureNotLocked / immutability after Validate', () => {
  it('leaves DRAFT and COMPUTED payruns open', () => {
    expect(() => {
      ensureNotLocked('DRAFT');
    }).not.toThrow();
    expect(() => {
      ensureNotLocked('COMPUTED');
    }).not.toThrow();
  });

  it('locks a VALIDATED payrun against further writes (rule W5)', () => {
    expect(() => {
      ensureNotLocked('VALIDATED');
    }).toThrow(/VALIDATED and its records can no longer be changed/);
  });

  it('locks a PAID payrun against further writes (rule W5)', () => {
    expect(() => {
      ensureNotLocked('PAID');
    }).toThrow(/PAID and its records can no longer be changed/);
  });
});

describe('ensureSendable', () => {
  it('refuses to send from DRAFT or COMPUTED (rule W8)', () => {
    expect(() => {
      ensureSendable('DRAFT');
    }).toThrow(/only be sent once a payrun is validated/);
    expect(() => {
      ensureSendable('COMPUTED');
    }).toThrow(/only be sent once a payrun is validated/);
  });

  it('allows sending once validated or paid', () => {
    expect(() => {
      ensureSendable('VALIDATED');
    }).not.toThrow();
    expect(() => {
      ensureSendable('PAID');
    }).not.toThrow();
  });
});

describe('canValidatePayrun (rule W6)', () => {
  it('allows validation with no warnings at all', () => {
    expect(canValidatePayrun([])).toBe(true);
  });

  it('blocks validation while any blocking warning stands, acknowledged or not', () => {
    expect(canValidatePayrun([{ blocking: true, acknowledgedAt: null }])).toBe(
      false,
    );
    expect(
      canValidatePayrun([{ blocking: true, acknowledgedAt: new Date() }]),
    ).toBe(false);
  });

  it('blocks validation while an advisory warning is unacknowledged', () => {
    expect(canValidatePayrun([{ blocking: false, acknowledgedAt: null }])).toBe(
      false,
    );
  });

  it('allows validation once every advisory warning is acknowledged', () => {
    expect(
      canValidatePayrun([
        { blocking: false, acknowledgedAt: new Date() },
        { blocking: false, acknowledgedAt: new Date() },
      ]),
    ).toBe(true);
  });

  it('mixed set: blocked while the blocking one remains, even if advisories are acknowledged', () => {
    expect(
      canValidatePayrun([
        { blocking: false, acknowledgedAt: new Date() },
        { blocking: true, acknowledgedAt: null },
      ]),
    ).toBe(false);
  });
});

describe('unresolvedWarningReasons', () => {
  it('names both blocking and unacknowledged counts when both are present', () => {
    const reasons = unresolvedWarningReasons([
      { blocking: true, acknowledgedAt: null },
      { blocking: true, acknowledgedAt: null },
      { blocking: false, acknowledgedAt: null },
    ]);
    expect(reasons).toEqual([
      '2 blocking warnings must be resolved (fix the data and recompute).',
      '1 advisory warning must be acknowledged.',
    ]);
  });

  it('is empty once nothing is unresolved', () => {
    expect(
      unresolvedWarningReasons([
        { blocking: false, acknowledgedAt: new Date() },
      ]),
    ).toEqual([]);
  });
});
