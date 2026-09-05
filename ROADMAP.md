# PayZ — Roadmap

The hackathon deliverables are a working platform with representative data, a five-minute demo of two end-to-end scenarios, and this: what we would do next, and what we knowingly did not do.

It is written against the code in this repository, not against an ambition. Everything named below as missing can be checked by opening the file it is missing from.

---

## What was deliberately left out

A 24-hour build has to choose what to do properly. Each of these was cut because doing it halfway would have been worse than not doing it — a half-scoped tenant boundary or a half-correct tax slab is a bug that looks like a feature.

| Left out                             | Why                                                                                                                                                                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-tenancy**                    | `companyId` is on every model that needs it, so the dashboard filter is real, but there is one seeded company and `getDefaultCompanyId()` hands it to every write. Real tenancy means scoping at the query layer and inside RBAC; done partially it leaks data. |
| **Statutory payroll compliance**     | PF, ESIC, PT and LWF exist as ordinary salary rules with configurable percentages — which is what the problem statement asks the engine to prove. Slab tables, exemption logic, Form 16 and challan filing are a compliance product, not a payroll engine.      |
| **Multi-currency**                   | Money is integer paise end to end, and the rounding assertions depend on a single currency. Adding a second currency means an exchange-rate source and a rounding policy per currency, both of which are decisions, not code.                                   |
| **Accounting-ledger posting**        | A validated payrun is the input to a journal entry, but nothing here is an accounting system, and inventing an approximate chart of accounts would misrepresent what the numbers are.                                                                           |
| **SSO / password reset**             | Auth is bcrypt plus a JWT in an httpOnly cookie, with admin-created accounts. OAuth and reset flows need email deliverability guarantees the demo does not have.                                                                                                |
| **Recruitment, appraisal, expenses** | Outside the Employee → Contract → Attendance/Time Off → Payrun → Payslip loop that the grading is about.                                                                                                                                                        |
| **Mobile apps, public portal**       | The Employee role sees its own records inside the same SPA. A separate self-service surface duplicates every permission decision.                                                                                                                               |

---

## Known limitations of what is here

These are real, and worth stating plainly because a reviewer will find them anyway.

**Single-tenant in practice.** `server/src/modules/common/company.ts` resolves one company for every create. Queries are not tenant-scoped; role checks are not company-aware. The schema is ready for more, the code is not.

**No delivery pipeline.** CI (`.github/workflows/ci.yml`) does format, lint, typecheck, build, and tests against a Postgres service container — but there is no Dockerfile for either app, no deploy job, and no environment beyond a developer laptop with `docker compose` running Postgres. Nothing has ever been deployed, so nothing about deployment has been proven.

**N+1 queries remain in payslip compute.** `computePayrunPayslips` batches contract resolution into one query, but each payslip still costs a duplicate-payslip lookup, an attendance-facts query, a line delete, a line insert and a payslip update — five or so round trips per employee, inside the transaction. It is fast enough for the 122-person demo run and the wrong shape for a real company.

**The payslip PDF has no text layer in the accessible sense.** `@react-pdf/renderer` emits positioned text — selectable, but an untagged document: no structure tree, no per-field semantics, no document metadata. A screen reader or a payroll-portal importer sees a flat stream of glyphs rather than "net pay: this number".

**The audit table is modelled but never written.** `audit_logs` is in `schema.prisma` and is truncated by the seed, and nothing in `server/src` ever inserts a row. Workflow transitions, approvals and role changes therefore leave no immutable trail; the dashboard's manual-edit signal is derived from `attendance.source` instead.

**Time is server-local.** Worked hours and lateness are judged with `Date#getHours()` (`server/src/modules/attendance/worked-hours.ts`), so the deployment's timezone is the company's timezone. `WorkingSchedule.timezone` is stored and not consulted.

**Time off is day-shaped.** `TimeOffUnit` allows `HOURS`, but every duration in the server is a working-day count (rule T6). An hourly leave type would be accepted by the form and then measured in days.

**Salary rules have no effective dates.** A rule carries `active` and nothing else temporal. Payslips snapshot their lines, so history cannot be rewritten, but "what did this rule say in April" is not a question the data can answer.

**Compute and bulk email run inside the HTTP request.** Sending payslips generates PDFs and talks to SMTP with a concurrency of three (`send-payslips.ts`); for a full payrun that is a long-lived request with no retry story. There is no job queue.

**Tests are unit-deep, not end-to-end.** The rules that decide money — the engine, the formula sandbox, workflow transitions, leave balance, RBAC, weekly hours — have tests. Routes have two suites, the client has none, and there is no browser test of the two demo scenarios.

---

## What comes next

Staged so that each stage is a coherent thing to finish, not a wish list. Stage 1 is what stands between this and running one real payroll on it.

### Stage 1 — Before anyone is paid from it

1. **Write the audit trail.** Every payrun transition, leave approval, manual attendance edit and role change inserts an `audit_logs` row with actor, entity and before/after. The table exists; this is the highest-value smallest change in the list, and payroll without it is not defensible to an auditor.
2. **Batch the compute queries.** Resolve duplicate payslips and attendance facts for the whole payrun in one query each, the way contracts already are, and insert lines in a single `createMany`. Then measure a full-company compute instead of assuming it.
3. **Route-level tests for the payrun workflow.** Compute → Validate blocked by a blocking warning → fix → recompute → Validate → Mark Paid, against a real database. The seeded off-cycle correction run gives that test its blocked state.
4. **Delivery.** A Dockerfile per app, a deploy job that runs `db:deploy` before the app starts, and one environment that is not a laptop. Backups and a restore drill for the payroll database, because a lost payslip is a legal problem.
5. **Move bulk send off the request.** A queue with retries and per-recipient status, so a mid-send SMTP failure does not leave half a payrun unsent and unrecorded.

### Stage 2 — The second company

1. **Tenant scoping at the data layer**, not in each route: a company-bound Prisma client or a required scope argument, so a query that forgets the tenant does not compile.
2. **Company-aware RBAC** — roles are per company, and a payroll manager at one is nobody at the other.
3. **SSO and password reset**, once there is a deployment with a real mail domain behind it.

### Stage 3 — Payroll depth

1. **Effective-dated salary rules and structure versions**, so a rate change in July is a new version rather than an edit, and April can still be explained.
2. **Statutory slabs as data** — PF, ESIC, PT and LWF thresholds with validity ranges, plus the statutory reports that follow from them.
3. **Hourly time off**, honouring `TimeOffUnit.HOURS` through duration, balance and payroll work entries.
4. **Timezone-correct attendance**, judged against the schedule's timezone rather than the server's.
5. **Tagged payslip PDFs** and a bulk archive export, so payslips are machine-readable by whatever the employee's bank or portal wants.

### Stage 4 — Scale and operations

1. **Observability** beyond request logs: compute duration per payrun, warning counts by code, failed sends — the numbers you need at 6 a.m. on payday.
2. **Background compute** for large payruns, with progress visible in the UI.
3. **Data retention and export**, since finalised payroll is history that outlives the software.

---

## What this roadmap is not

No dates, no headcount, no throughput numbers. Nothing here has been load-tested, so any figure would be invented. The ordering is the claim: correctness and auditability before scale, and tenancy before features.
