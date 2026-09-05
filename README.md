# PayZ — Integrated HR & Payroll Platform

> Odoo HR Payroll Hackathon (24-hour) — problem statement *"PeoplePay360: HR & Payroll — An Integrated Human Resource and Payroll Operations Platform"*

PayZ is an end-to-end HR and Payroll platform where the **Employee record is the central hub**. Contracts and Working Schedules supply payroll context, Attendance and Time Off capture day-to-day HR activity, Salary Structures and Rules define how pay is computed, and Payruns turn eligible employees into validated Payslips that can be printed as PDF and emailed.

The point of the project is the **connected operational flow and business logic** — period-based contract selection, allocation-backed leave balances, ordered salary-rule computation, and pre-finalisation payroll warnings — not CRUD screens.

---

## Table of Contents

- [Scope](#scope)
- [Core Business Rules](#core-business-rules)
- [Payrun Workflow](#payrun-workflow)
- [Roles & Permissions](#roles--permissions)
- [Tech Stack](#tech-stack)
- [Screens & Routes](#screens--routes)
- [Project Structure](#project-structure)
- [Setup](#setup)
- [Seed Data & Demo Scenarios](#seed-data--demo-scenarios)
- [Out of Scope](#out-of-scope)

---

## Scope

### In scope

| Module | What it covers |
| --- | --- |
| **Employees** | Kanban + List + Form views, work/private info, department, manager, job position, schedule, active status, smart buttons to related records |
| **Contracts** | Historical contracts per employee, wage, dates, department, position, salary structure, status; the **Running** contract drives payroll |
| **Working Schedules** | List + Form, weekly pattern (day / start / end / break), weekly hours **derived** from the pattern, assignable to employee or contract |
| **Attendance** | Global list + per-employee view, check-in/check-out widget, worked hours, overtime, status (Present / Late / Absent), authorised manual corrections |
| **Time Off** | Requests (approve / refuse), Allocations (approval grants balance), Time Off Types (unit, allocation requirement, approval level, payroll work-entry) |
| **Salary Structures** | Containers of ordered Salary Rules; rule count and employee count; selected on a Payrun |
| **Salary Rules** | Name, Code, Category (Basic / Allowance / Gross / Deduction / Net), Sequence, and computation: **Fixed Amount**, **Percentage of a base**, or **Formula** |
| **Payruns** | Two-step creation wizard (scope, then employee selection), then `Draft → Compute → Validate → Mark Paid`, plus Send Payslips |
| **Payslips** | Per-employee salary computation lines, worked days, gross/net, warnings, PDF print |
| **Dashboard** | Live KPI cards, Salary Cost by Department, Monthly Net Salary Trend, Payslip Status & Alerts, Attendance Overview, Time Off Overview, Department Overview — all filtered by Period / Department / Employee Type / Company |
| **Auth & Roles** | Admin-created users linked to an Employee, role-gated navigation and actions |

### Deliverables targeted

- Functional platform populated with representative demo data
- Two end-to-end demo scenarios (employee to payslip; allocation to request to balance)
- Payslip PDF generation and bulk email from the Payrun
- Live dashboard driven by real records, never hardcoded values

---

## Core Business Rules

These are the rules the system enforces, and the reason the project is more than CRUD.

1. **One Running contract per employee per period.** Overlapping `Running` contracts are rejected at save time.
2. **Payroll uses the period-applicable contract** — the contract whose date range covers the Payrun period, not merely the newest one. An employee without an applicable contract is excluded from the run with a warning.
3. **Weekly hours are derived**, never typed: the sum of `(end − start − break)` across the schedule day lines.
4. **Approved allocations create balance; approved requests consume it.** `remaining = allocated − taken`. A request for a type that requires allocation fails if there is no approved allocation with sufficient remaining balance in a valid period.
5. **Balance moves on approval**, not on submission — and refusing or cancelling an approved request returns the days.
6. **Salary rules compute in ascending `sequence`**, so later rules (GROSS, NET) can reference the results of earlier ones through the rule and category context.
7. **A payslip is immutable once validated.** Compute is only allowed while the Payrun is `Draft` or `Computed`.
8. **Warnings surface before finalisation** — missing bank details, duplicate payslip for the same employee and period, expiring contracts, absent contract — and the run reports them prior to Validate.
9. **Attendance worked hours** are computed from check-in/check-out; overtime is the positive delta against the schedule expected hours for that day.
10. **Finalised payroll is historical.** Paid Payruns and their payslips are read-only and remain queryable for trends.
11. **Role gating is enforced server-side**, not only in the UI; users cannot assign or elevate their own roles.

## Payrun Workflow

```
                    ┌──────────────── recompute ────────────────┐
                    ▼                                           │
 [Wizard: scope → employees] ─► DRAFT ─Compute─► COMPUTED ──────┴─Validate─► VALIDATED ─Mark Paid─► PAID
                                                    │                                                │
                                              warnings shown                                Send Payslips / PDF
```

- **Step 1 (scope):** Employee Type, Salary Structure, Period — `Continue` does **not** create the Payrun.
- **Step 2 (selection):** eligible employees are listed with schedule, start date and wage; `Create Payrun` creates the batch containing only the selected employees.
- **Compute:** generates or refreshes one Payslip per employee by running the structure rules in sequence against the period contract.
- **Validate:** locks payslips after warnings are reviewed.
- **Mark Paid:** finalises the batch as historical payroll.

## Roles & Permissions

| Role | Capability |
| --- | --- |
| **Employee** | Own details, own attendance and leave balances; create attendance entries and time off requests. No HR admin, no payroll. |
| **HR Manager** | Full CRUD on Employees, Contracts, Working Schedules, Attendance, Time Off; approve or refuse requests. No payroll. |
| **HR Payroll User** | HR Manager plus create/read/update on Payruns and Payslips; read-only Salary Structures and Rules. |
| **HR Payroll Manager** | HR Payroll User plus full CRUD on Payruns, Payslips, Structures and Rules. |
| **Admin** | Everything, plus user management and role assignment. |

## Tech Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 15 (App Router) + TypeScript** | One deployable for UI and API; server actions keep payroll logic on the server |
| Styling | **Tailwind CSS v4** + shadcn/ui | Fast, consistent, Odoo-like density |
| Database | **PostgreSQL** (SQLite for zero-setup local dev) | Real relational integrity for the entity graph |
| ORM | **Prisma** | Typed models and migrations that match the entity design |
| Auth | Session cookie (JWT via `jose`) + `bcrypt` | Minimal config, role claims enforced server-side |
| Validation | **Zod** | Shared request and form schemas |
| Charts | **Recharts** | Dashboard trend and department charts |
| PDF | **@react-pdf/renderer** | Server-side payslip PDF without a headless browser |
| Email | **Nodemailer** (SMTP, console transport fallback) | Bulk payslip delivery from the Payrun |
| Formulas | Sandboxed expression evaluator | Salary-rule `FORMULA` computation with a restricted context |

## Screens & Routes

Top navigation mirrors the wireframe: **Employees ▼ · Contracts ▼ · Attendance · Time Off ▼ · Payroll ▼**

| Route | Screen |
| --- | --- |
| `/login` | Sign in |
| `/employees` | Employee Kanban / List (view toggle) |
| `/employees/[id]` | Employee Form plus smart buttons (Contracts, Attendance, Time Off, Allocations) |
| `/departments` | Departments |
| `/working-schedules`, `/working-schedules/[id]` | Schedule list / weekly-pattern form |
| `/contracts`, `/contracts/[id]` | Contract list / form |
| `/attendance`, `/attendance/[id]` | Attendance list / form, plus global check-in/out widget |
| `/time-off/requests`, `/time-off/requests/[id]` | Requests list / form with approve and refuse |
| `/time-off/allocations`, `/time-off/allocations/[id]` | Allocations list / form |
| `/time-off/types`, `/time-off/types/[id]` | Time Off Type policy list / form |
| `/payroll/payruns`, `/payroll/payruns/[id]` | Payrun list / processing screen (2-step creation wizard) |
| `/payroll/payslips`, `/payroll/payslips/[id]` | Payslip list / salary computation and PDF |
| `/payroll/structures`, `/payroll/structures/[id]` | Salary Structure list / form with ordered rules |
| `/payroll/rules`, `/payroll/rules/[id]` | Salary Rule list / form |
| `/dashboard` | Payroll Dashboard with Period / Department / Employee Type / Company filters |
| `/admin/users` | User and role management (Admin only) |

## Project Structure

```
src/
  app/
    (auth)/login/
    (app)/employees/ contracts/ attendance/ time-off/ payroll/ dashboard/ admin/
    api/                      # PDF, email, export endpoints
  server/
    payroll/                  # rule engine, payslip computation, warnings
    timeoff/                  # balance math, allocation consumption
    attendance/               # worked hours, overtime
    contracts/                # period-applicable contract resolution
    dashboard/                # aggregation queries
    auth/                     # session, RBAC guards
  components/                 # ui/, forms, list and kanban shells, charts
  lib/                        # prisma client, date/period helpers, money, zod schemas
prisma/
  schema.prisma
  seed.ts
```

## Setup

**Prerequisites:** Node.js 20+ and npm. PostgreSQL is optional — the default local setup runs on SQLite.

```bash
git clone https://github.com/Kavish0001/Odoo-HR-Payroll-Hackathon-PayZ.git
cd Odoo-HR-Payroll-Hackathon-PayZ

npm install
cp .env.example .env          # then edit values

npx prisma migrate dev        # create the database schema
npm run seed                  # load demo employees, contracts, rules, payroll data

npm run dev                   # http://localhost:3000
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Prisma connection string (SQLite file or Postgres URL) |
| `AUTH_SECRET` | Session signing secret |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | Payslip email delivery; unset falls back to a console transport |

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run seed` | Reset and load demo data |
| `npm run lint` / `npm run typecheck` | Lint and type-check |

## Seed Data & Demo Scenarios

The seed loads departments, employees, working schedules, historical and running contracts, a `Regular Salary` structure with sequenced rules (BASIC, HRA, STD, GROSS, PF, PT, NET), time off types with allocations, attendance records, and prior payruns so the dashboard trend has history.

**Scenario A — Employee to Payslip:** create an employee, assign a schedule, add a Running contract, create a Payrun (scope, then select employees), Compute, review warnings, Validate, Mark Paid, print PDF, send payslips.

**Scenario B — Allocation to Balance:** define a Time Off Type requiring allocation, allocate days and approve, employee submits a request, manager approves, balance drops, and the dashboard Time Off overview reflects it.

## Out of Scope

Deliberately excluded for the 24-hour build: SSO/OAuth and password-reset flows, multi-currency and tax-authority filings, accounting-ledger posting, recruitment and appraisal modules, expense claims, mobile apps, and a public employee self-service portal beyond the own-records views.

---

## License

Built for the Odoo HR Payroll Hackathon. Reference material (problem statement PDF and wireframes) lives in an untracked `Archive/` folder.
