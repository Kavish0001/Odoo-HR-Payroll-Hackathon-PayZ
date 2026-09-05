import { describe, expect, it } from 'vitest';

import {
  htmlBody,
  plainBody,
  type PayslipMailTarget,
} from './send-payslips.js';

const target: PayslipMailTarget = {
  payslipId: 'p1',
  employeeId: 'e1',
  employeeEmail: 'someone@example.com',
  employeeName: 'Amit Mishra',
  number: 'PS/2026/04146',
  periodLabel: '2026-08-01 to 2026-08-31',
  netAmount: 5_571_341,
};

describe('payslip email bodies', () => {
  it('carries the same facts in text and in HTML', () => {
    const text = plainBody(target);
    const html = htmlBody(target);

    for (const body of [text, html]) {
      expect(body).toContain('PS/2026/04146');
      expect(body).toContain('₹55,713.41');
    }
    expect(text).toContain('Amit Mishra');
    expect(html).toContain('Amit Mishra');
  });

  it('never puts the recipient address in the body', () => {
    expect(plainBody(target)).not.toContain('someone@example.com');
    expect(htmlBody(target)).not.toContain('someone@example.com');
  });

  // A name is the one field a person controls, and it is interpolated into
  // markup; an unescaped angle bracket would break the message open.
  it('escapes markup in a name', () => {
    const html = htmlBody({
      ...target,
      employeeName: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
