import { Link } from 'react-router-dom';

import { Logo } from '../../components/brand/Logo.js';

import { FlowDiagram } from './FlowDiagram.js';

/**
 * The public marketing page, outside the signed-in application.
 *
 * Same design language as the console: four colours, monospace eyebrows, a
 * hairline grid, and red reserved for the logo underline and the single call
 * to action.
 */

const FEATURES = [
  {
    index: '01',
    title: 'One employee record',
    body: 'Contracts, schedules, attendance and leave all hang off the same person. Open an employee and every related record is one click away, already filtered.',
  },
  {
    index: '02',
    title: 'Contracts that know their period',
    body: 'Payroll uses the contract that applies to the period being paid, not the newest one on file. A raise effective in July never reaches an April payslip.',
  },
  {
    index: '03',
    title: 'Salary rules you can actually change',
    body: 'Fixed amounts, percentages of any base, or a formula. Rules run in sequence, so gross and net build on what came before rather than being typed in.',
  },
  {
    index: '04',
    title: 'Problems surface before payment',
    body: 'Missing bank details, duplicate payslips, expiring contracts. Blocking issues stop a payrun being validated instead of being found afterwards.',
  },
] as const;

const NUMBERS = [
  { value: '4', label: 'Modules, one record' },
  { value: '12', label: 'Salary rules, in sequence' },
  { value: '0', label: 'Hardcoded figures' },
] as const;

export function LandingPage(): React.JSX.Element {
  return (
    <div className="bg-steel-50 text-ink min-h-screen">
      {/* ---- Top bar ------------------------------------------------------ */}
      <header className="border-steel-300 border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Logo size={30} withWordmark />
          <Link
            to="/login"
            className="border-steel-300 hover:bg-steel-100 font-mono rounded-sm border px-4 py-2 text-[11px] tracking-wider uppercase transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* ---- Hero --------------------------------------------------------- */}
      <section className="border-steel-300 border-b">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <p className="eyebrow">
              // Payroll &amp; HR &mdash; unified system
            </p>

            <h1 className="font-display mt-6 text-5xl leading-[1.05] font-bold tracking-tight lg:text-6xl">
              Payroll and HR,
              <br />
              finally in one place.
            </h1>

            <p className="text-muted mt-6 max-w-md text-base leading-relaxed">
              Most HR tools keep employees, attendance, leave and salary in
              separate boxes and leave the joining up to you. PayZ treats them
              as one chain, from the employee record through to a validated
              payslip.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                to="/login"
                className="bg-signal font-mono rounded-sm px-6 py-3 text-[11px] tracking-wider text-white uppercase transition-opacity hover:opacity-90"
              >
                Open the console
              </Link>
              <a
                href="#how"
                className="border-steel-300 hover:bg-steel-100 font-mono rounded-sm border px-6 py-3 text-[11px] tracking-wider uppercase transition-colors"
              >
                How it works
              </a>
            </div>
          </div>

          <div className="border-steel-300 bg-raised rounded-sm border p-6">
            <FlowDiagram />
          </div>
        </div>
      </section>

      {/* ---- Numbers ------------------------------------------------------ */}
      <section className="border-steel-300 border-b">
        <div className="divide-steel-300 mx-auto grid max-w-6xl grid-cols-1 divide-y px-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {NUMBERS.map((item) => (
            <div key={item.label} className="px-6 py-10 first:pl-0 last:pr-0">
              <p className="font-display text-4xl font-bold tabular-nums">
                {item.value}
              </p>
              <p className="eyebrow mt-2">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Features ----------------------------------------------------- */}
      <section id="how" className="border-steel-300 border-b">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="eyebrow">// What it does</p>
          <h2 className="font-display mt-4 max-w-2xl text-3xl font-bold tracking-tight">
            Built around the parts that are usually left to spreadsheets.
          </h2>

          <div className="mt-14 grid gap-px sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <article
                key={feature.index}
                className="border-steel-300 bg-raised border p-8"
              >
                <div className="flex items-start gap-4">
                  <span
                    aria-hidden="true"
                    className="metal-badge mt-1 h-7 w-7 shrink-0"
                  />
                  <div>
                    <p className="eyebrow">{feature.index}</p>
                    <h3 className="font-display mt-2 text-lg font-bold tracking-tight">
                      {feature.title}
                    </h3>
                    <p className="text-muted mt-3 text-sm leading-relaxed">
                      {feature.body}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Call to action ----------------------------------------------- */}
      <section className="dot-grid border-steel-300 border-b">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            Ready to run a payrun?
          </h2>
          <p className="text-muted mx-auto mt-4 max-w-md text-sm">
            The demo workspace is loaded with employees, contracts, attendance
            and five finalised payroll periods.
          </p>
          <Link
            to="/login"
            className="bg-signal font-mono mt-10 inline-block rounded-sm px-8 py-3.5 text-[11px] tracking-wider text-white uppercase transition-opacity hover:opacity-90"
          >
            Sign in to PayZ
          </Link>
        </div>
      </section>

      {/* ---- Footer ------------------------------------------------------- */}
      <footer className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="eyebrow">
            PayZ HR &amp; Payroll &mdash; system console
          </p>
          <p className="eyebrow">Odoo HR Payroll Hackathon</p>
        </div>
      </footer>
    </div>
  );
}
