/**
 * Payslip numbers, formatted like the seed data: `PS/2026/00007`.
 *
 * `startingFrom` is read once per batch (see payruns.routes.ts), and every
 * payslip created in that batch takes the next sequential value — sequential
 * within the call, not a database-wide atomic counter, which is adequate for
 * a single admin creating one payrun at a time in a hackathon-scale system.
 */
export function payslipNumber(year: number, sequence: number): string {
  return `PS/${String(year)}/${String(sequence).padStart(5, '0')}`;
}
