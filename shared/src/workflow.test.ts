import { describe, expect, it } from 'vitest';

import { PAYRUN_STATUSES, type PayrunStatus } from './enums.js';
import {
  allowedTransitions,
  canCompute,
  canTransition,
  isPayrunLocked,
} from './workflow.js';

describe('payrun transitions (rule W4)', () => {
  it('walks the happy path Draft to Compute to Validate to Mark Paid', () => {
    expect(canTransition('DRAFT', 'COMPUTED')).toBe(true);
    expect(canTransition('COMPUTED', 'VALIDATED')).toBe(true);
    expect(canTransition('VALIDATED', 'PAID')).toBe(true);
  });

  it('allows recompute from COMPUTED', () => {
    expect(canTransition('COMPUTED', 'COMPUTED')).toBe(true);
  });

  it('refuses to skip Compute', () => {
    expect(canTransition('DRAFT', 'VALIDATED')).toBe(false);
    expect(canTransition('DRAFT', 'PAID')).toBe(false);
  });

  it('refuses to walk backwards out of a finalised run', () => {
    expect(canTransition('PAID', 'COMPUTED')).toBe(false);
    expect(canTransition('PAID', 'VALIDATED')).toBe(false);
    expect(canTransition('VALIDATED', 'COMPUTED')).toBe(false);
  });

  it('treats PAID and CANCELLED as terminal (rule W5)', () => {
    for (const status of PAYRUN_STATUSES) {
      expect(canTransition('PAID', status)).toBe(false);
      expect(canTransition('CANCELLED', status)).toBe(false);
    }
    expect(allowedTransitions('PAID')).toHaveLength(0);
    expect(allowedTransitions('CANCELLED')).toHaveLength(0);
  });

  it('allows cancelling anything not yet paid', () => {
    expect(canTransition('DRAFT', 'CANCELLED')).toBe(true);
    expect(canTransition('COMPUTED', 'CANCELLED')).toBe(true);
    expect(canTransition('VALIDATED', 'CANCELLED')).toBe(true);
  });

  it('defines transitions for every status, so no state is a dead end by omission', () => {
    for (const status of PAYRUN_STATUSES) {
      expect(allowedTransitions(status)).toBeDefined();
    }
  });
});

describe('isPayrunLocked (rule W5)', () => {
  it('locks validated and paid runs', () => {
    expect(isPayrunLocked('VALIDATED')).toBe(true);
    expect(isPayrunLocked('PAID')).toBe(true);
  });

  it('leaves open runs writable', () => {
    expect(isPayrunLocked('DRAFT')).toBe(false);
    expect(isPayrunLocked('COMPUTED')).toBe(false);
  });
});

describe('canCompute (rules P9, W4)', () => {
  it('permits compute only while the run is still open', () => {
    const computable: PayrunStatus[] = ['DRAFT', 'COMPUTED'];
    const locked: PayrunStatus[] = ['VALIDATED', 'PAID', 'CANCELLED'];

    for (const status of computable) {
      expect(canCompute(status)).toBe(true);
    }
    for (const status of locked) {
      expect(canCompute(status)).toBe(false);
    }
  });
});
