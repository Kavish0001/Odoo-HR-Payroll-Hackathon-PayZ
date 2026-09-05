<!-- ─────────────────────────────  BANNER  ───────────────────────────── -->
<div align="center">

<img
  src="https://capsule-render.vercel.app/api?type=waving&color=0:0d0d0d,55:2b2e33,100:ff0000&height=210&section=header&text=PayZ&fontSize=88&fontColor=ffffff&fontAlignY=34&desc=Integrated%20HR%20%26%20Payroll%20Operations%20Platform&descSize=17&descAlignY=54&animation=fadeIn"
  alt="PayZ — Integrated HR & Payroll Operations Platform"
/>

<!-- ─────────────────────────────  TYPING  ───────────────────────────── -->

<a href="#-screens">
  <img
    src="https://readme-typing-svg.demolab.com?font=Space+Mono&weight=700&size=20&pause=1200&color=FF0000&center=true&vCenter=true&width=760&lines=Employee+%E2%86%92+Contract+%E2%86%92+Attendance+%E2%86%92+Payrun+%E2%86%92+Payslip;One+chain%2C+not+five+disconnected+CRUD+screens;130+employees+%C2%B7+4%2C162+payslips+%C2%B7+%E2%82%B981.2L+net+paid"
    alt="Employee to payslip, one connected chain"
  />
</a>

<br/>

<!-- ─────────────────────────────  BADGES  ───────────────────────────── -->

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_19-0D0D0D?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite_7-2B2E33?style=for-the-badge&logo=vite&logoColor=FFD62E)
![Node.js](https://img.shields.io/badge/Node_20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express_5-0D0D0D?style=for-the-badge&logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_17-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

<br/>

![Tests](https://img.shields.io/badge/tests-236_passing-ff0000?style=for-the-badge&labelColor=0d0d0d)
![Typecheck](https://img.shields.io/badge/typecheck-clean-2b2e33?style=for-the-badge&labelColor=0d0d0d)
![Lint](https://img.shields.io/badge/eslint-0_warnings-2b2e33?style=for-the-badge&labelColor=0d0d0d)
![Hackathon](https://img.shields.io/badge/Odoo_Hackathon-24_hours-ff0000?style=for-the-badge&labelColor=0d0d0d)

<br/>

**[Screens](#-screens)** · **[Business Rules](#-core-business-rules)** · **[Architecture](#-architecture)** · **[Guardrails](#-guardrails)** · **[Setup](#-setup)** · **[Roadmap](ROADMAP.md)**

</div>

---

## ⚡ The Point

> **PeoplePay360 — An Integrated Human Resource and Payroll Operations Platform**
> _Odoo HR Payroll Hackathon · 24 hours_

Most HR tools keep employees, attendance, leave and salary in separate boxes and leave the joining up to you. **PayZ treats them as one chain** — the Employee record is the hub, Contracts and Working Schedules supply payroll context, Attendance and Time Off capture daily activity, Salary Rules define computation, and Payruns turn eligible employees into validated Payslips that print as PDF and send by email.

The interesting part is **the connected flow and the business logic** — period-based contract selection, allocation-backed leave balances, ordered salary-rule computation, pre-finalisation payroll warnings — not the CRUD screens.

```text
Employee ──► Contract ──► Working Schedule ──► Attendance ──► Payrun ──► Payslip ──► PDF + Email
                │                                   │            │
                └──────── Salary Structure ─────────┘            └──► Warnings block Validate
```

---

## 📸 Screens

<div align="center">

### The landing page and the console

<img src="assets/screenshots/01-landing.jpg" alt="PayZ landing page — Payroll and HR, finally in one place" width="100%"/>

<em>Machined-industrial visual language: brushed steel surfaces, monospace chrome, and red reserved strictly for destructive actions and blocking warnings.</em>

<br/><br/>

### Payroll dashboard — every figure computed, none hardcoded

<img src="assets/screenshots/03-dashboard-kpis.jpg" alt="Payroll dashboard KPIs" width="100%"/>

<img src="assets/screenshots/04-dashboard-charts.jpg" alt="Salary by department, net salary trend, payslip status and alerts" width="100%"/>

<em>Live KPIs, salary cost by department, monthly net-salary trend, and a payroll alert queue that separates <strong>blocking</strong> from <strong>advisory</strong>.</em>

</div>

<br/>

<table>
<tr>
<td width="50%" valign="top">

**Employees — Kanban by department**

<img src="assets/screenshots/05-employees-kanban.jpg" alt="Employee kanban grouped by department"/>

130 seeded employees across six departments, with a Kanban/List toggle.

</td>
<td width="50%" valign="top">

**Payslip — the full computation**

<img src="assets/screenshots/06-payslip-detail.jpg" alt="Payslip detail with computed salary lines"/>

Every line traced back to the rule and category that produced it.

</td>
</tr>
<tr>
<td width="50%" valign="top">

**Payrun — warnings that actually block**

<img src="assets/screenshots/07-payrun-warnings.jpg" alt="Payrun with blocking duplicate-payslip warnings"/>

`DUPLICATE_PAYSLIP` refuses Validate and cannot be acknowledged away.

</td>
<td width="50%" valign="top">

**Time Off — balance, derived**

<img src="assets/screenshots/08-timeoff-dashboard.jpg" alt="Time off balances and pending approvals"/>

`remaining = allocated − taken`, with pending shown separately.

</td>
</tr>
</table>

<br/>

<div align="center">

### The same app, seen by an Employee

</div>

<table>
<tr>
<td width="50%" valign="top">

<img src="assets/screenshots/09-employee-self-service.jpg" alt="Employee self-service profile, mostly read-only"/>

**Their own record.** Navigation collapses to `My Profile · My Attendance · My Time Off · My Payslips`. Employment facts render as **text, not inputs** — only Phone and the private contact/bank fields are theirs to change.

</td>
<td width="50%" valign="top">

<img src="assets/screenshots/10-my-payslips.jpg" alt="Employee viewing only their own payslips"/>

**Their own pay.** The API pins the query to their employee id, so asking for `?employeeId=1` still returns only their own — and the Employee column and HR warning queue are dropped entirely.

</td>
</tr>
<tr>
<td width="50%" valign="top">

<img src="assets/screenshots/11-attendance.jpg" alt="Employee viewing their own attendance records"/>

**Their own hours.** Worked hours and `LATE` / `PRESENT` status computed from check-in and check-out, scoped to them by the API — so the employee filter is not even rendered.

</td>
<td width="50%" valign="top">

<img src="assets/screenshots/02-login.jpg" alt="PayZ sign-in screen"/>

**One way in.** Accounts are created by an administrator; there is no public sign-up. The JWT lives in an httpOnly cookie and carries a `tokenVersion`, so a role change invalidates issued tokens immediately.

</td>
</tr>
</table>

---

## 📐 Core Business Rules

These are the rules the system **enforces**, and the reason this is more than CRUD.

| #      | Rule                                                                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1**  | **One Running contract per employee per period.** Overlapping `RUNNING` contracts are rejected at save time — by a database constraint, not a service check.                                                 |
| **2**  | **Payroll uses the period-applicable contract**, the one whose range covers the Payrun period, not merely the newest. No applicable contract ⇒ excluded, with a warning.                                     |
| **3**  | **Weekly hours are derived**, never typed: `Σ (end − start − break)` across the schedule day lines.                                                                                                          |
| **4**  | **Approved allocations create balance; approved requests consume it.** `remaining = allocated − taken`.                                                                                                      |
| **5**  | **Balance moves on approval**, not on submission — and refusing or cancelling an approved request returns the days.                                                                                          |
| **6**  | **Salary rules compute in ascending `sequence`**, so GROSS and NET can read what earlier rules produced.                                                                                                     |
| **7**  | **A payslip is immutable once validated.** Compute is allowed only while the Payrun is `DRAFT` or `COMPUTED`.                                                                                                |
| **8**  | **Warnings surface before finalisation** — missing bank details, duplicate payslip, expiring contract, absent contract.                                                                                      |
| **9**  | **Attendance worked hours** come from check-in/out; overtime is the positive delta against that day's expected schedule hours.                                                                               |
| **10** | **Finalised payroll is historical.** Paid Payruns and their payslips are read-only and stay queryable for trends.                                                                                            |
| **11** | **Role gating is enforced server-side**, not only in the UI; nobody can assign or elevate their own roles.                                                                                                   |
| **12** | **Approving is a separate permission from editing.** An employee may edit their own pending request (`update`); deciding anyone's is `approve`, from HR Manager up. Nobody decides their own.                |
| **13** | **Self-service is scoped by resource, not by rank.** `readSelf` / `updateSelf` reach your own payslip and contact details; the route then pins the query to your employee id and narrows the update payload. |

---

## 🔄 Payrun Workflow

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#f5f5f5','primaryTextColor':'#1a1a1a','primaryBorderColor':'#2b2e33','lineColor':'#7a8a8e','noteBkgColor':'#dff1f1','noteBorderColor':'#ff0000','noteTextColor':'#1a1a1a','fontFamily':'Space Mono, monospace'}}}%%
stateDiagram-v2
    direction LR
    [*] --> DRAFT : Wizard — scope, then employees
    DRAFT --> COMPUTED : Compute
    COMPUTED --> COMPUTED : Recompute
    COMPUTED --> VALIDATED : Validate — warnings reviewed
    VALIDATED --> PAID : Mark Paid
    PAID --> [*] : Send Payslips · Print PDF

    note right of COMPUTED
        Blocking warnings refuse Validate.
        Advisory warnings require acknowledgement.
    end note
```

- **Step 1 — scope:** Employee Type, Salary Structure, Period. `Continue` does **not** create the Payrun.
- **Step 2 — selection:** eligible employees listed with schedule, start date and wage; `Create Payrun` creates the batch with only those selected.
- **Compute:** generates or refreshes one Payslip per employee, running the structure's rules in sequence against the period contract.
- **Validate:** locks payslips once warnings are reviewed. **Mark Paid:** finalises the batch as history.

---

## 👥 Roles & Permissions

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#dff1f1','primaryTextColor':'#1a1a1a','primaryBorderColor':'#2b2e33','lineColor':'#7a8a8e','fontFamily':'Space Mono, monospace'}}}%%
flowchart LR
    E["EMPLOYEE<br/>rank 0"] --> H["HR_MANAGER<br/>rank 1"]
    H --> PU["HR_PAYROLL_USER<br/>rank 2"]
    PU --> PM["HR_PAYROLL_MANAGER<br/>rank 3"]
    PM --> A["ADMIN<br/>rank 4"]

    style E fill:#ffffff,stroke:#bbd5da
    style H fill:#dff1f1,stroke:#bbd5da
    style PU fill:#dff1f1,stroke:#7a8a8e
    style PM fill:#bbd5da,stroke:#2b2e33
    style A fill:#2b2e33,stroke:#ff0000,color:#ffffff
```

| Role                   | Capability                                                                                                                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Employee**           | Their own record, attendance, leave balances and payslips. Files and withdraws their own time off, records their own attendance, corrects their own contact and bank details. **Approves nothing.** No HR admin, no payroll. |
| **HR Manager**         | Full CRUD on Employees, Contracts, Working Schedules, Attendance, Time Off; approves or refuses requests. No payroll beyond their own payslip.                                                                               |
| **HR Payroll User**    | HR Manager plus create/read/update on Payruns and Payslips; read-only Salary Structures and Rules.                                                                                                                           |
| **HR Payroll Manager** | HR Payroll User plus full CRUD on Payruns, Payslips, Structures and Rules.                                                                                                                                                   |
| **Admin**              | Everything, plus user management and role assignment.                                                                                                                                                                        |

> **Every screen is gated on the same permission its navbar link is**, so a path cannot be reached by typing it that could not be reached by clicking it. A form a role cannot save renders as **the record**, not as inputs behind a button that answers `403`.

---

## 🏗 Architecture

A dedicated backend and a separate frontend, sharing **one validation layer**.

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#ffffff','primaryTextColor':'#1a1a1a','primaryBorderColor':'#2b2e33','lineColor':'#7a8a8e','fontFamily':'Space Mono, monospace'}}}%%
flowchart LR
    subgraph C["client/ · :5173"]
        direction TB
        C1["Vite + React 19 + TS"]
        C2["TanStack Query · Router v7"]
        C3["React Hook Form + Zod"]
    end

    subgraph S["server/ · :4000"]
        direction TB
        S1["Express 5 + TypeScript"]
        S2["Payroll engine · RBAC guards"]
        S3["PDF render · Gmail SMTP"]
    end

    subgraph D["PostgreSQL 17 · :5433"]
        direction TB
        D1["Prisma · 20 models"]
        D2["GiST + unique constraints"]
    end

    SH["shared/ — Zod schemas + types"]

    C -->|"/api proxy"| S
    S -->|Prisma| D
    SH -.->|one contract| C
    SH -.->|one contract| S

    style SH fill:#dff1f1,stroke:#ff0000,stroke-width:2px
    style C fill:#f5f5f5,stroke:#bbd5da
    style S fill:#f5f5f5,stroke:#bbd5da
    style D fill:#f5f5f5,stroke:#bbd5da
```

The payroll engine, RBAC guards and dashboard aggregations live in the API — unambiguously server-side and independently testable. `shared/` holds the Zod schemas and types, so **the API validator and the React forms can never drift apart**.

---

## 🧰 Tech Stack

<div align="center">

| Layer            | Weight in the build                                    |
| ---------------- | ------------------------------------------------------ |
| TypeScript       | `████████████████████████` shared end to end           |
| Backend / Domain | `███████████████████░░░░░` engine, RBAC, warnings, PDF |
| Frontend / UI    | `████████████████░░░░░░░░` 40+ screens, charts, forms  |
| Database         | `████████████░░░░░░░░░░░░` 20 models, constraint-first |
| Tooling / CI     | `████████░░░░░░░░░░░░░░░░` lint, typecheck, 236 tests  |

</div>

<table>
<tr><td valign="top" width="50%">

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

</td><td valign="top" width="50%">

**Backend — `server/`**

| Concern    | Choice                                            |
| ---------- | ------------------------------------------------- |
| Runtime    | Node 20+ · Express 5 · TS (`tsx watch`)           |
| ORM        | Prisma                                            |
| Database   | **PostgreSQL 17 in Docker**                       |
| Validation | Zod (shared with the client)                      |
| Auth       | `jsonwebtoken` + `bcrypt`, JWT in httpOnly cookie |
| PDF        | `@react-pdf/renderer`                             |
| Email      | Nodemailer over **Gmail SMTP**, console fallback  |
| Hardening  | helmet · express-rate-limit · pino-http           |

</td></tr>
</table>

---

## 🛡 Guardrails

> Payroll writes money to real records, so the system **fails loudly** rather than quietly producing a wrong payslip. Rules are enforced at the deepest layer that can express them — **the UI is never the enforcement point.**

| Guardrail                         | What it prevents                                                                                                                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔒 **Database constraints**       | A GiST exclusion constraint makes overlapping `RUNNING` contracts _impossible_; unique indexes back one-payslip-per-employee-per-period, unique rule codes and sequences, one open attendance session per employee.   |
| 🧪 **Formula sandbox**            | Rule expressions parse to an AST and evaluate against an allowlist. No `require`, `process`, `constructor`, `__proto__`, loops or assignments beyond `result`; 50 ms timeout; `NaN`/`Infinity`/÷0 raise `RULE_ERROR`. |
| ⏭ **Forward-reference detection** | A formula referencing a higher-sequence rule is rejected before compute — sequence means nothing if a rule can read the future.                                                                                       |
| 🪙 **Integer money**              | All amounts stored as integer paise, formatted only at the edge, with post-compute assertions that `NET == GROSS + Σ deductions` and nothing is negative.                                                             |
| 🔁 **Atomic balance consumption** | Leave approval takes a row lock, re-reads remaining, and rejects if insufficient — two managers approving at once cannot overdraw an allocation.                                                                      |
| 🧊 **Immutable history**          | Validated and paid payruns reject all writes; payslips snapshot their contract and wage so later edits cannot rewrite the past.                                                                                       |
| 🔀 **Optimistic locking**         | `version` columns on Payrun and Payslip return `409` rather than letting two officers interleave a Compute.                                                                                                           |
| 👤 **Server-side RBAC**           | Every mutating route declares its permission or **fails a startup assertion**; `EMPLOYEE` queries are rewritten server-side to their own records; nobody can elevate their own roles.                                 |
| ⚙️ **Fail-fast config**           | Env vars are Zod-parsed at boot, so a missing `DATABASE_URL` or short `JWT_SECRET` stops the server with a readable message.                                                                                          |
| ✉️ **Email safety**               | `MAIL_REDIRECT_TO` keeps seeded demo addresses from ever being emailed by accident; bulk send is concurrency-limited with per-recipient results.                                                                      |

---

## 🚀 Setup

**Prerequisites:** Node.js 20+, npm, and **Docker Desktop running** (Postgres runs in a container).

```bash
git clone https://github.com/Kavish0001/Odoo-HR-Payroll-Hackathon-PayZ.git
cd Odoo-HR-Payroll-Hackathon-PayZ

npm install                   # installs client, server and shared workspaces
cp .env.example .env          # then fill in the values below

npm run db:up                 # start PostgreSQL 17 on localhost:5433
npm run db:migrate            # create the schema
npm run db:seed               # demo employees, contracts, rules, payroll history

npm run dev                   # API :4000 + client :5173
```

Open **<http://localhost:5173>**. Adminer is at **<http://localhost:8081>** to browse tables directly.

> [!IMPORTANT]
> `npm run dev` starts **both halves**. Running only the client leaves the API down, and every request fails with a generic _"Something went wrong"_ — that message means _nobody answered_, not _wrong password_.

### 🔑 Demo accounts

All seeded accounts share the password **`payz-demo-2026`**.

| Email              | Role                 | What the console looks like                                   |
| ------------------ | -------------------- | ------------------------------------------------------------- |
| `admin@oxp.com`    | `ADMIN`              | Everything, plus `/admin/users`                               |
| `payroll@oxp.com`  | `HR_PAYROLL_MANAGER` | Full payroll — payruns, structures, rules, dashboard          |
| `hr@oxp.com`       | `HR_MANAGER`         | All HR master data, leave approvals — **no payroll**          |
| `employee@oxp.com` | `EMPLOYEE`           | `My Profile · My Attendance · My Time Off · My Payslips` only |

Every other seeded employee has an account at `firstname.lastname@oxp.com`.

<details>
<summary><b>⚙️ Environment variables</b></summary>

<br/>

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

</details>

<details>
<summary><b>✉️ Gmail SMTP setup</b></summary>

<br/>

Gmail rejects a plain account password — an App Password is required:

1. Enable **2-Step Verification** on the Google account.
2. Go to **Google Account → Security → App passwords** and create one for "Mail".
3. Paste the 16 characters (spaces removed) into `SMTP_PASS`.
4. Run `npm run mail:check` — it opens and authenticates a connection without sending anything, and names the usual cause when it fails. Add `-- --send` to also put one test message in the inbox.

> [!WARNING]
> Set `MAIL_REDIRECT_TO` to your own address before the first real send. Without it, _Send Payslips_ mails all 122 seeded `@oxp.com` addresses — a fast way to get a Gmail account rate-limited.

Send limits are roughly **500 recipients/day** on free Gmail and 2,000 on Workspace — well above a demo payrun. Leave `SMTP_USER` unset and the mailer falls back to a console transport, so _Send Payslips_ stays demoable with no network.

</details>

<details>
<summary><b>📜 Scripts</b></summary>

<br/>

| Command                             | Description                                                                |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `npm run db:up` / `npm run db:down` | Start / stop the Postgres container (the volume survives `down`)           |
| `npm run db:migrate`                | `prisma migrate dev`                                                       |
| `npm run db:seed`                   | Reset and load demo data (refuses to run against a non-localhost database) |
| `npm run mail:check`                | Verify SMTP credentials without sending; `-- --send` sends one test        |
| `npm run db:studio`                 | Prisma Studio                                                              |
| `npm run dev`                       | Run API and client concurrently                                            |
| `npm run build`                     | Type-check and build both apps                                             |
| `npm run verify`                    | Lint + typecheck + tests + build                                           |

</details>

---

## 🌱 Seed Data & Demo Scenarios

The seed loads departments, employees, working schedules, historical and running contracts, a `Regular Salary` structure with sequenced rules (BASIC → HRA → STD → GROSS → PF → PT → NET), time off types with allocations, attendance records, and prior payruns so the dashboard trend has real history.

<table>
<tr><td valign="top" width="50%">

**🅰 Scenario A — Employee to Payslip**

Create an employee → assign a schedule → add a Running contract → create a Payrun (scope, then select) → **Compute** → review warnings → **Validate** → **Mark Paid** → print PDF → send payslips.

</td><td valign="top" width="50%">

**🅱 Scenario B — Allocation to Balance**

Define a Time Off Type requiring allocation → allocate days and approve → employee submits a request → manager approves → **balance drops** → the dashboard Time Off overview reflects it.

</td></tr>
</table>

> [!NOTE]
> **The blocked payrun is real.** The seed leaves one `COMPUTED` run — _August 2026 Off-cycle Correction_, covering 16–31 August for two engineers already paid for the whole month — carrying a blocking `DUPLICATE_PAYSLIP` warning. **Validate refuses it**, and the warning cannot be acknowledged away. Both are produced by the real Compute path, not written into the database by hand. Leave durations are counted the same way: working days against the employee's own schedule, never calendar days.

---

<details>
<summary><h2>🎨 Design System</h2></summary>

### Brand mark

The PayZ mark is a **minted coin**: a brushed gunmetal face with an engraved grille and a red mint mark on the lower rim.

| Asset           | Use                                                      |
| --------------- | -------------------------------------------------------- |
| `payz-icon.svg` | 48px and above — login screen, about, payslip PDF header |
| `payz-mark.svg` | Below 48px — favicon, navbar, tab strip                  |

Two files, because the full coin carries a brush pattern, a reeded edge and three machining rings that collapse into grey mud below roughly 48px. The simplified mark keeps only what survives at 16px: the silhouette, the gunmetal gradient, the grille, and the red mint mark that makes the tab identifiable. The `<Logo>` component picks between them by rendered size, so no caller has to remember which is which.

The palette follows from the mark — gunmetal for structure, the mint-mark red **reserved** for destructive actions and blocking payroll warnings so it keeps its urgency:

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

**Loading.** Self-hosted `.woff2` in `client/public/fonts` with `font-display: swap` and a preload hint for the 400/500 UI weights — no render-blocking request to Google's CDN during the demo, and no layout shift on hackathon wifi.

**In the PDF.** `@react-pdf/renderer` embeds font files rather than reading a stylesheet, and it wants TrueType, not woff2. So the PDF keeps its own `.ttf` copies under `server/assets/fonts`, registered by `server/src/pdf/fonts.ts`. If those files are ever missing the document falls back to Helvetica rather than failing — a payslip in the wrong face is cosmetic, a payslip that will not download is not.

### Type scale

| Token     | Size / line-height | Use                                       |
| --------- | ------------------ | ----------------------------------------- |
| `display` | 28 / 34            | Dashboard KPI values                      |
| `h1`      | 20 / 28            | Page titles (`Employee / Aarav Mehta`)    |
| `h2`      | 16 / 24            | Form section headers (`Work Information`) |
| `body`    | 14 / 20            | Default — form fields, table cells        |
| `small`   | 12 / 16            | Table headers, helper text, status chips  |

14px body keeps list views dense the way an HR tool should be, and Space Grotesk stays legible at 12px for column headers.

</details>

<details>
<summary><h2>🗺 Screens & Routes</h2></summary>

Top navigation mirrors the wireframe: **Employees ▼ · Contracts ▼ · Attendance · Time Off ▼ · Payroll ▼** — and collapses to self-service for an Employee.

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

</details>

<details>
<summary><h2>📁 Project Structure</h2></summary>

npm workspaces — three packages, one lockfile.

```text
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
│     ├─ middleware/             # auth, requirePermission, validate, errors
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
│     ├─ main.tsx  App.tsx
│     ├─ api/                    # axios client + query hooks per module
│     ├─ layouts/                # AppLayout, Navbar, RequirePermission
│     ├─ components/
│     │  ├─ ui/                  # shadcn primitives
│     │  ├─ data/                # DataTable, StatusBadge, SmartButton, FormShell
│     │  ├─ charts/              # SalaryByDepartment, SalaryTrend, PayslipStatus
│     │  └─ attendance/          # AttendanceWidget
│     ├─ pages/                  # mirrors the route table above
│     └─ lib/                    # auth context, role guards, formatters
│
└─ shared/
   └─ src/                       # zod schemas + types + enums + rbac used by BOTH apps
```

</details>

---

## 🚧 Out of Scope

Deliberately excluded for the 24-hour build: SSO/OAuth and password-reset flows, multi-currency and tax-authority filings, accounting-ledger posting, recruitment and appraisal modules, expense claims, and mobile apps.

## 🧭 Roadmap

[`ROADMAP.md`](ROADMAP.md) covers the rest of the deliverable: why each exclusion above was a **choice rather than an oversight**, the limitations of what _is_ here (single-tenant, no delivery pipeline, remaining N+1 queries in payslip compute, an untagged payslip PDF, an audit table nothing writes to), and the staged plan that follows.

---

## 📄 License

Built for the **Odoo HR Payroll Hackathon**. Reference material (problem statement PDF and wireframes) lives in an untracked `Archive/` folder.

<div align="center">

<br/>

**Built by [@Kavish0001](https://github.com/Kavish0001)**

[![Repo](https://img.shields.io/badge/PayZ-Odoo_HR_Payroll_Hackathon-ff0000?style=for-the-badge&logo=github&logoColor=white&labelColor=0d0d0d)](https://github.com/Kavish0001/Odoo-HR-Payroll-Hackathon-PayZ)

<img
  src="https://capsule-render.vercel.app/api?type=waving&color=0:ff0000,45:2b2e33,100:0d0d0d&height=140&section=footer"
  alt=""
/>

</div>
