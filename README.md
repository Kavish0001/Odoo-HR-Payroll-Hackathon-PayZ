# PayZ — Integrated HR & Payroll Platform

> Odoo HR Payroll Hackathon (24-hour) — problem statement _"PeoplePay360: HR & Payroll — An Integrated Human Resource and Payroll Operations Platform"_

PayZ is an end-to-end HR and Payroll platform where the **Employee record is the central hub**. Contracts and Working Schedules supply payroll context, Attendance and Time Off capture day-to-day HR activity, Salary Structures and Rules define how pay is computed, and Payruns turn eligible employees into validated Payslips that can be printed as PDF and emailed.

The point of the project is the **connected operational flow and business logic** — period-based contract selection, allocation-backed leave balances, ordered salary-rule computation, and pre-finalisation payroll warnings — not CRUD screens.

---

## Table of Contents

- [Scope](#scope)
- [Core Business Rules](#core-business-rules)
- [Payrun Workflow](#payrun-workflow)
- [Roles & Permissions](#roles--permissions)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Guardrails](#guardrails)
- [Design System](#design-system)
- [Screens & Routes](#screens--routes)
- [Project Structure](#project-structure)
- [Setup](#setup)
- [Seed Data & Demo Scenarios](#seed-data--demo-scenarios)
- [Out of Scope](#out-of-scope)

---

## Scope

### In scope

| Module                | What it covers                                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Employees**         | Kanban + List + Form views, work/private info, department, manager, job position, schedule, active status, smart buttons to related records                                                                               |
| **Contracts**         | Historical contracts per employee, wage, dates, department, position, salary structure, status; the **Running** contract drives payroll                                                                                   |
| **Working Schedules** | List + Form, weekly pattern (day / start / end / break), weekly hours **derived** from the pattern, assignable to employee or contract                                                                                    |
| **Attendance**        | Global list + per-employee view, check-in/check-out widget, worked hours, overtime, status (Present / Late / Absent), authorised manual corrections                                                                       |
| **Time Off**          | Requests (approve / refuse), Allocations (approval grants balance), Time Off Types (unit, allocation requirement, approval level, payroll work-entry)                                                                     |
| **Salary Structures** | Containers of ordered Salary Rules; rule count and employee count; selected on a Payrun                                                                                                                                   |
| **Salary Rules**      | Name, Code, Category (Basic / Allowance / Gross / Deduction / Net), Sequence, and computation: **Fixed Amount**, **Percentage of a base**, or **Formula**                                                                 |
| **Payruns**           | Two-step creation wizard (scope, then employee selection), then `Draft → Compute → Validate → Mark Paid`, plus Send Payslips                                                                                              |
| **Payslips**          | Per-employee salary computation lines, worked days, gross/net, warnings, PDF print                                                                                                                                        |
| **Dashboard**         | Live KPI cards, Salary Cost by Department, Monthly Net Salary Trend, Payslip Status & Alerts, Attendance Overview, Time Off Overview, Department Overview — all filtered by Period / Department / Employee Type / Company |
| **Auth & Roles**      | Admin-created users linked to an Employee, role-gated navigation and actions                                                                                                                                              |

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

| Role                   | Capability                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Employee**           | Own details, own attendance and leave balances; create attendance entries and time off requests. No HR admin, no payroll. |
| **HR Manager**         | Full CRUD on Employees, Contracts, Working Schedules, Attendance, Time Off; approve or refuse requests. No payroll.       |
| **HR Payroll User**    | HR Manager plus create/read/update on Payruns and Payslips; read-only Salary Structures and Rules.                        |
| **HR Payroll Manager** | HR Payroll User plus full CRUD on Payruns, Payslips, Structures and Rules.                                                |
| **Admin**              | Everything, plus user management and role assignment.                                                                     |

## Architecture

A dedicated backend and a separate frontend, sharing one validation layer.

```
┌──────────────────────┐        ┌───────────────────────┐        ┌──────────────────┐
│  client/             │  /api  │  server/              │        │  PostgreSQL 17   │
│  Vite + React + TS   │───────►│  Express + TS         │───────►│  in Docker       │
│  :5173               │ proxy  │  Prisma · Zod · JWT   │ Prisma │  :5433           │
└──────────────────────┘        │  payroll engine       │        └──────────────────┘
           │                    │  PDF · Gmail SMTP     │
           └──── shared/ ───────┤  :4000                │
                zod schemas     └───────────────────────┘
                + TS types
```

The payroll engine, RBAC guards and dashboard aggregations live in the API — unambiguously server-side and independently testable. `shared/` holds the Zod schemas and types, so the API validator and the React forms can never drift apart.

## Tech Stack

**Frontend — `client/`**

| Concern      | Choice                         |
| ------------ | ------------------------------ |
| Build        | Vite 7 + React 19 + TypeScript |
| Routing      | React Router v7                |
| Server state | TanStack Query                 |
| Styling      | Tailwind CSS v4 + shadcn/ui    |
| Tables       | TanStack Table (headless)      |
| Forms        | React Hook Form + Zod resolver |
| Charts       | Recharts                       |
| HTTP         | Axios with `withCredentials`   |

**Backend — `server/`**

| Concern    | Choice                                                     |
| ---------- | ---------------------------------------------------------- |
| Runtime    | Node 20+ · Express 5 · TypeScript (`tsx watch` in dev)     |
| ORM        | Prisma                                                     |
| Database   | **PostgreSQL 17 in Docker**                                |
| Validation | Zod (shared with the client)                               |
| Auth       | `jsonwebtoken` + `bcrypt`, JWT in an httpOnly cookie       |
| PDF        | `@react-pdf/renderer`                                      |
| Email      | Nodemailer over **Gmail SMTP**, console-transport fallback |
| Hardening  | helmet · express-rate-limit · pino-http                    |

## Guardrails

Payroll writes money to real records, so the system fails loudly rather than quietly producing a wrong payslip. Rules are enforced at the deepest layer that can express them — the UI is never the enforcement point.

- **Database constraints** — a GiST exclusion constraint makes overlapping `RUNNING` contracts _impossible_; unique indexes back one-payslip-per-employee-per-period, unique rule codes and sequences per structure, and one open attendance session per employee.
- **Formula sandbox** — rule expressions are parsed to an AST and evaluated against an allowlist. No `require`, `process`, `constructor`, `__proto__`, loops or assignments beyond `result`; 50 ms timeout; `NaN`/`Infinity`/division-by-zero raise a `RULE_ERROR` instead of writing garbage.
- **Forward-reference detection** — a formula referencing a higher-sequence rule is rejected before compute, because sequence means nothing if a rule can read the future.
- **Integer money** — all amounts stored as integer paise, formatted only at the edge, with post-compute assertions that `NET == GROSS + Σ deductions` and nothing is negative.
- **Atomic balance consumption** — leave approval takes a row lock, re-reads remaining, and rejects if insufficient; two managers approving at once cannot overdraw an allocation.
- **Immutable history** — validated and paid payruns reject all writes; payslips snapshot their contract and wage so later edits cannot rewrite the past.
- **Optimistic locking** — `version` columns on Payrun and Payslip return 409 rather than letting two officers interleave a Compute.
- **Server-side RBAC** — every mutating route declares its roles or fails a startup assertion; `EMPLOYEE` queries are rewritten server-side to their own records; users cannot elevate their own roles.
- **Fail-fast config** — env vars are Zod-parsed at boot, so a missing `DATABASE_URL` or a short `JWT_SECRET` stops the server with a readable message.
- **Email safety** — `MAIL_REDIRECT_TO` keeps seeded demo addresses from ever being emailed by accident; bulk send is concurrency-limited with per-recipient results.

Full detail in section 10 of the system design plan.

## Design System

### Brand mark

The PayZ mark is a minted coin: a brushed gunmetal face with an engraved grille and a red mint mark on the lower rim.

| Asset           | Use                                                      |
| --------------- | -------------------------------------------------------- |
| `payz-icon.svg` | 48px and above - login screen, about, payslip PDF header |
| `payz-mark.svg` | Below 48px - favicon, navbar, tab strip                  |

Two files, because the full coin carries a brush pattern, a reeded edge and three machining rings that collapse into grey mud below roughly 48px. The simplified mark keeps only what survives at 16px: the silhouette, the gunmetal gradient, the grille, and the red mint mark that makes the tab identifiable. The `<Logo>` component picks between them by rendered size, so no caller has to remember which is which.

The palette follows from the mark - gunmetal for structure, the mint-mark red reserved for destructive actions and blocking payroll warnings so it keeps its urgency:

```css
--color-metal-900: oklch(0.29 0.008 260); /* coin face, dark */
--color-metal-500: oklch(0.68 0.006 260); /* coin face, mid  */
--color-brand: oklch(0.52 0.21 26); /* mint-mark red   */
```

### Typography

**Space Grotesk** for the interface, **Space Mono** for figures and codes. The two are siblings — Space Grotesk was drawn from Space Mono — so the pairing reads as one voice rather than two fonts bolted together.

| Role            | Face              | Weights         | Used for                                                                                                          |
| --------------- | ----------------- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| UI              | **Space Grotesk** | 400 / 500 / 700 | Navigation, labels, form fields, headings, body copy                                                              |
| Figures & codes | **Space Mono**    | 400 / 700       | Salary amounts, worked hours, rule codes (`BASIC`, `HRA`), contract references (`CON/2026/0042`), payslip numbers |

```css
--font-ui: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
--font-mono: 'Space Mono', ui-monospace, 'Cascadia Code', monospace;
```

**Why a mono for the numbers.** Payslip and dashboard tables stack currency down a column, and proportional digits make those columns ragged. Every numeric cell — amounts, hours, balances, headcounts — renders in Space Mono with `font-variant-numeric: tabular-nums`, so decimal points line up and a ₹1,50,000 row sits flush under a ₹96,000 row. Rule codes and contract references get the same treatment because they read as identifiers, not prose.

Space Grotesk's own digits are checked for `tnum` support at scaffold time; where the feature is absent the mono face covers the numeric columns regardless, so alignment never depends on it.

**Loading.** Self-hosted `.woff2` in `client/public/fonts` with `font-display: swap` and a preload hint for the 400/500 UI weights — no render-blocking request to Google's CDN during the demo, and no layout shift when the network is slow on hackathon wifi.

**In the PDF.** `@react-pdf/renderer` embeds font files rather than reading a stylesheet, and it wants TrueType, not the woff2 a browser takes. So the PDF keeps its own `.ttf` copies of the same families under `server/assets/fonts`, registered by `server/src/pdf/fonts.ts`: Space Grotesk for the company name, figures and totals, Inter for everything read as prose. If those files are ever missing the document falls back to the built-in Helvetica rather than failing — a payslip in the wrong face is cosmetic, a payslip that will not download is not.

### Type scale

| Token     | Size / line-height | Use                                       |
| --------- | ------------------ | ----------------------------------------- |
| `display` | 28 / 34            | Dashboard KPI values                      |
| `h1`      | 20 / 28            | Page titles (`Employee / Aarav Mehta`)    |
| `h2`      | 16 / 24            | Form section headers (`Work Information`) |
| `body`    | 14 / 20            | Default — form fields, table cells        |
| `small`   | 12 / 16            | Table headers, helper text, status chips  |

14px body keeps list views dense the way an HR tool should be, and Space Grotesk stays legible at 12px for column headers.

## Screens & Routes

Top navigation mirrors the wireframe: **Employees ▼ · Contracts ▼ · Attendance · Time Off ▼ · Payroll ▼**

| Route                                                 | Screen                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| `/login`                                              | Sign in                                                                         |
| `/employees`                                          | Employee Kanban / List (view toggle)                                            |
| `/employees/[id]`                                     | Employee Form plus smart buttons (Contracts, Attendance, Time Off, Allocations) |
| `/departments`                                        | Departments                                                                     |
| `/working-schedules`, `/working-schedules/[id]`       | Schedule list / weekly-pattern form                                             |
| `/contracts`, `/contracts/[id]`                       | Contract list / form                                                            |
| `/attendance`, `/attendance/[id]`                     | Attendance list / form, plus global check-in/out widget                         |
| `/time-off/requests`, `/time-off/requests/[id]`       | Requests list / form with approve and refuse                                    |
| `/time-off/allocations`, `/time-off/allocations/[id]` | Allocations list / form                                                         |
| `/time-off/types`, `/time-off/types/[id]`             | Time Off Type policy list / form                                                |
| `/payroll/payruns`, `/payroll/payruns/[id]`           | Payrun list / processing screen (2-step creation wizard)                        |
| `/payroll/payslips`, `/payroll/payslips/[id]`         | Payslip list / salary computation and PDF                                       |
| `/payroll/structures`, `/payroll/structures/[id]`     | Salary Structure list / form with ordered rules                                 |
| `/payroll/rules`, `/payroll/rules/[id]`               | Salary Rule list / form                                                         |
| `/dashboard`                                          | Payroll Dashboard with Period / Department / Employee Type / Company filters    |
| `/admin/users`                                        | User and role management (Admin only)                                           |

## Project Structure

npm workspaces — three packages, one lockfile.

```
payz/
├─ docker-compose.yml            # postgres:17-alpine + adminer
├─ package.json                  # workspaces + root scripts
│
├─ server/                       # dedicated backend API  (:4000)
│  ├─ prisma/
│  │  ├─ schema.prisma           # 20 models + Postgres constraints
│  │  ├─ migrations/
│  │  └─ seed.ts
│  └─ src/
│     ├─ index.ts                # express app, helmet, rate limit, error handler
│     ├─ config/                 # env.ts (zod, fail-fast), prisma.ts, mailer.ts
│     ├─ middleware/             # auth, requireRole, validate, errors
│     ├─ modules/                # router + controller + service per module
│     │  ├─ auth/ employees/ departments/ job-positions/
│     │  ├─ schedules/           # derived weekly hours, expected hours
│     │  ├─ contracts/           # period-contract resolution, overlap check
│     │  ├─ attendance/          # worked hours, check-in/out
│     │  ├─ timeoff/             # types, allocations, requests, balance
│     │  ├─ payroll/
│     │  │  ├─ structures/ rules/
│     │  │  ├─ engine.ts         # sequence loop, rules[] / categories[] context
│     │  │  ├─ evaluate-rule.ts  # FIXED | PERCENTAGE | FORMULA
│     │  │  ├─ sandbox.ts        # AST-allowlist formula evaluation
│     │  │  ├─ compute-payslip.ts  warnings.ts  workflow.ts
│     │  │  └─ send-payslips.ts  # queued Gmail bulk send
│     │  ├─ dashboard/           # kpis, by-department, trend, alerts
│     │  └─ users/               # admin user + role management
│     ├─ pdf/                    # payslip-document.tsx, coin-mark.tsx, fonts.ts
│     └─ lib/                    # period, money (integer paise), dates
│
├─ client/                       # Vite React SPA  (:5173)
│  ├─ vite.config.ts             # /api proxy → :4000
│  └─ src/
│     ├─ main.tsx  App.tsx  routes.tsx
│     ├─ api/                    # axios client + query hooks per module
│     ├─ layouts/                # AppLayout (navbar + attendance widget), AuthLayout
│     ├─ components/
│     │  ├─ ui/                  # shadcn primitives
│     │  ├─ data/                # DataTable, KanbanGrid, StatusBadge, SmartButton,
│     │  │                       # FormShell, FilterBar
│     │  ├─ charts/              # DepartmentBar, NetSalaryTrend
│     │  └─ payroll/             # PayrunWizard, ComputationTable, WarningList
│     ├─ pages/                  # mirrors the route table above
│     └─ lib/                    # auth context, role guards, formatters
│
└─ shared/
   └─ src/                       # zod schemas + types + enums used by BOTH apps
```

## Setup

**Prerequisites:** Node.js 20+, npm, and **Docker Desktop running** (Postgres runs in a container).

```bash
git clone https://github.com/Kavish0001/Odoo-HR-Payroll-Hackathon-PayZ.git
cd Odoo-HR-Payroll-Hackathon-PayZ

npm install                   # installs client, server and shared workspaces
cp .env.example .env          # then fill in the values below

npm run db:up                 # start PostgreSQL 17 on localhost:5433
npm run db:migrate            # create the schema
npm run db:seed               # load demo employees, contracts, rules, payroll history

npm run dev                   # API :4000 + client :5173
```

Open **http://localhost:5173**. Adminer is at **http://localhost:8081** if you want to browse tables directly.

### Environment variables

| Variable                  | Purpose                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | `postgresql://payz:payz@localhost:5433/payz?schema=public`                                                                    |
| `JWT_SECRET`              | Session signing secret — **must be at least 32 characters** or the server refuses to boot                                     |
| `PORT`                    | API port, defaults to `4000`                                                                                                  |
| `CLIENT_ORIGIN`           | CORS allowlist entry, defaults to `http://localhost:5173`                                                                     |
| `SMTP_HOST` / `SMTP_PORT` | `smtp.gmail.com` / `587`                                                                                                      |
| `SMTP_USER` / `SMTP_PASS` | Your Gmail address and a **16-character App Password**                                                                        |
| `MAIL_FROM`               | e.g. `PayZ Payroll <you@gmail.com>`                                                                                           |
| `MAIL_REDIRECT_TO`        | Optional. Redirects every outgoing mail to this address in development so seeded demo addresses are never emailed by accident |

### Gmail SMTP setup

Gmail rejects a plain account password — an App Password is required:

1. Enable **2-Step Verification** on the Google account.
2. Go to **Google Account → Security → App passwords** and create one for "Mail".
3. Paste the 16 characters (spaces removed) into `SMTP_PASS`.
4. Run `npm run mail:check` — it opens and authenticates a connection without
   sending anything, and names the usual cause when it fails. Add `-- --send`
   to also put one test message in the inbox.

Set `MAIL_REDIRECT_TO` to your own address before the first real send. Without
it, _Send Payslips_ mails all 122 seeded `@oxp.com` addresses, which is a fast
way to get a Gmail account rate-limited.

Send limits are roughly **500 recipients/day** on a free Gmail account and 2,000 on Workspace — well above a demo payrun. Leave `SMTP_USER` unset and the mailer falls back to a console transport, so _Send Payslips_ stays demoable with no network.

### Scripts

| Command                              | Description                                                                |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `npm run db:up` / `npm run db:down`  | Start / stop the Postgres container (the volume survives `down`)           |
| `npm run db:migrate`                 | `prisma migrate dev`                                                       |
| `npm run db:seed`                    | Reset and load demo data (refuses to run against a non-localhost database) |
| `npm run mail:check`                 | Verify the SMTP credentials without sending; `-- --send` sends one test    |
| `npm run db:studio`                  | Prisma Studio                                                              |
| `npm run dev`                        | Run API and client concurrently                                            |
| `npm run build`                      | Type-check and build both apps                                             |
| `npm run lint` / `npm run typecheck` | Lint and type-check                                                        |

## Seed Data & Demo Scenarios

The seed loads departments, employees, working schedules, historical and running contracts, a `Regular Salary` structure with sequenced rules (BASIC, HRA, STD, GROSS, PF, PT, NET), time off types with allocations, attendance records, and prior payruns so the dashboard trend has history.

**Scenario A — Employee to Payslip:** create an employee, assign a schedule, add a Running contract, create a Payrun (scope, then select employees), Compute, review warnings, Validate, Mark Paid, print PDF, send payslips.

**Scenario B — Allocation to Balance:** define a Time Off Type requiring allocation, allocate days and approve, employee submits a request, manager approves, balance drops, and the dashboard Time Off overview reflects it.

## Out of Scope

Deliberately excluded for the 24-hour build: SSO/OAuth and password-reset flows, multi-currency and tax-authority filings, accounting-ledger posting, recruitment and appraisal modules, expense claims, mobile apps, and a public employee self-service portal beyond the own-records views.

---

## License

Built for the Odoo HR Payroll Hackathon. Reference material (problem statement PDF and wireframes) lives in an untracked `Archive/` folder.
