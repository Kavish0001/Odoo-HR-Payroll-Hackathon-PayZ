# PayZ — Build Orchestration

How the 24 hours are divided between agents, what each phase must deliver, and where commits land.

## Principles

1. **The controller owns every decision.** Agents implement against a written contract; they do not choose schemas, routes, or business rules.
2. **Schema before parallelism.** Nothing forks until `schema.prisma` and `shared/` are migrated and pushed. Two agents guessing at a model shape costs more than doing it once, serially.
3. **At most two agents at a time.** Deliberate pacing over fan-out — cheaper, reviewable, and a failed lane costs one rollback rather than five.
4. **Every checkpoint is a commit and a push.** Work that only exists on this laptop does not count.
5. **Guardrails are not a later phase.** Constraints ship in the migration that creates the table; RBAC ships with the route.

## Quality gate

Non-negotiable, enforced by tooling rather than discipline. **A checkpoint that fails any gate is not a checkpoint.**

### The gate

```
npm run lint        # ESLint, zero warnings tolerated (--max-warnings 0)
npm run typecheck   # tsc --noEmit, strict
npm run test        # Vitest, must pass
npm run build       # both apps compile
```

All four run locally before every commit, and again in CI on every push.

### ESLint — strict, typed

Flat config at the root, `typescript-eslint` **strictTypeChecked + stylisticTypeChecked**, so rules see real types rather than syntax:

| Rule | Setting | Why |
| --- | --- | --- |
| `@typescript-eslint/no-explicit-any` | **error** | `any` in a payroll engine is how wrong money reaches a payslip |
| `no-floating-promises` | **error** | An unawaited transaction is a silent data bug |
| `no-misused-promises` | **error** | Async handlers passed where void is expected |
| `explicit-function-return-type` | error on exported functions | Service signatures stay readable and stable |
| `no-unchecked-index-access` (tsconfig) | **on** | `rules['HRA']` is `T \| undefined` — forces the guardrail from 10.5 to be written |
| `no-unsafe-assignment/return/argument` | **error** | Blocks untyped Prisma or request data leaking into logic |
| `eqeqeq`, `no-console` (server: warn) | error | Use the logger, not `console.log` |
| `import/order` | error | Deterministic import blocks, fewer merge conflicts between lanes |

Boundary rules that keep the lanes honest:

- `client/**` may not import from `server/**`, and vice versa. Both may import `shared/**`.
- `shared/**` may not import from either app.
- Enforced by `eslint-plugin-boundaries`, so a lane violation fails CI rather than being caught in review.

`tsconfig` runs `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `noImplicitOverride`.

### Tests — Vitest

Not blanket coverage. Tests concentrate where a bug is expensive and invisible:

| Area | What is tested | Phase |
| --- | --- | --- |
| **Salary rule engine** | Sequence order, FIXED/PERCENTAGE/FORMULA, `rules[]` and `categories[]` context, GROSS and NET arithmetic, integer-paise rounding | P4 |
| **Formula sandbox** | Every rejection in 10.5 — `require`, `process`, `constructor`, `__proto__`, loops, timeout, forward references, `NaN`/`Infinity`/div-by-zero | P4 |
| **Period contract resolution** | C2 boundary cases: contract starting mid-period, ending mid-period, open-ended, none applicable | P2 |
| **Leave balance** | T1–T5: allocation grants, request consumes, refuse returns, insufficient balance rejected, non-allocation types skip the check | P3 |
| **Worked hours** | A1/A2: worked hours, overtime against schedule, missing checkout | P3 |
| **Weekly hours** | S1: derived total across day lines with breaks | P2 |
| **Workflow transitions** | W4/W5: every legal and illegal transition, immutability after Validate | P5 |
| **RBAC** | R2/R5: employee scoping, self-role-elevation refused | P1 |

Integration tests run against the Docker Postgres on a `payz_test` database, migrated and truncated per suite — the exclusion constraint and unique indexes are only real if tested against real Postgres.

**Rule: a business rule from section 3 of the design plan ships with the test that proves it.** The test is part of the same commit, not a follow-up.

### CI/CD — GitHub Actions

`.github/workflows/ci.yml`, on every push and pull request to `main`:

```
jobs:
  quality      → install · lint · typecheck · build      (fast, fails first)
  test         → postgres:17 service container · migrate · vitest
```

- Postgres runs as a service container, so integration tests hit real Postgres in CI exactly as they do locally.
- Node 20, npm cache keyed on the lockfile.
- Concurrency group cancels superseded runs, so 100 pushes do not queue 100 builds.
- The build artefact is uploaded on `main`, giving a deployable bundle at every checkpoint.

**CD** is deliberately out of scope for the hackathon window — there is no production environment to deploy to, and a broken deploy at hour 20 costs more than it proves. The pipeline stops at a verified, uploaded build artefact. Section 12 of the design plan lists Fly.io/Render as the roadmap item.

### Pre-commit

Husky + lint-staged runs ESLint and Prettier on staged files, so a red commit is difficult to create by accident. `--no-verify` is not used.

## Agent roster

| ID | Agent | Owns | Never touches |
| --- | --- | --- | --- |
| **C0** | **Controller** (this session) | Schema, `shared/` contracts, business rules, code review, all commits and pushes, demo script | — |
| **A1** | **Backend & Database** | Prisma models and migrations, Express modules, services, payroll engine, RBAC middleware, guardrails | `client/**` |
| **A2** | **Frontend** | Vite app, layouts, navbar, components, pages, charts, forms | `server/**`, `prisma/**` |
| **A3** | **Integration** | Seed data, PDF, Gmail send, wiring lanes together, end-to-end flows, demo rehearsal | Schema changes (requests them from C0) |

Lane isolation is by directory, so A1 and A2 can run concurrently without merge conflicts. `shared/` is written by C0 only — it is the contract both lanes compile against.

## Phases

| Phase | Blocks | Lead | Runs with | Delivers |
| --- | --- | --- | --- | --- |
| **P0 — Foundation** | 0 | C0 | — | Docker Postgres up, npm workspaces, Vite + Express skeletons, all 20 Prisma models, guardrail constraints, first migration, `/api/health` green |
| **P1 — Contracts & Auth** | 1 | C0 | — | `shared/` Zod schemas and types for every entity, auth (bcrypt + JWT cookie), `requireAuth` / `requireRole`, fail-fast env |
| **P2 — HR Master Data** | 2–4 | A1 | A2 | Employees, Departments, Job Positions, Working Schedules (derived hours), Contracts (overlap constraint, period resolution) — API + screens |
| **P3 — Daily HR Ops** | 5–6 | A1 | A2 | Attendance (worked hours, overtime, check-in/out widget), Time Off (types, allocations, requests, row-locked balance) |
| **P4 — Payroll Engine** | 7–8 | C0 | A2 | Salary Structures and Rules CRUD, **the engine**: sequence loop, three computation types, AST sandbox, integer paise, assertions. Controller-owned — this is the graded core |
| **P5 — Payrun Workflow** | 9–10 | A1 | A2 | Two-step wizard (stateless preview), processing screen, transition table, warnings, payslip detail, PDF, Gmail bulk send |
| **P6 — Dashboard** | 11 | A1 | A2 | Aggregation endpoints and the dashboard screen: KPIs, charts, overviews, alerts |
| **P7 — Integration & Demo** | 12–13 | A3 | — | Seed with history, end-to-end scenario passes, empty states, polish, demo rehearsal, roadmap |

## Checkpoints and commit cadence

Target **~100 commits**. Each phase carries named checkpoints; every checkpoint is `commit` + `push origin main`. Commits are scoped to one coherent change — a model, a route group, a screen — never "wip".

| Phase | Checkpoints | Approx commits |
| --- | --- | --- |
| P0 | compose file · workspaces · server skeleton · client skeleton · schema · migration · health | 8 |
| P1 | shared schemas · env · password + token · middleware · login route · login screen · guards | 9 |
| P2 | 4 modules × (API · screens · wiring) + constraints | 20 |
| P3 | attendance API · hours engine · widget · screens · timeoff types · allocations · requests · balance lock · screens | 16 |
| P4 | structures · rules · sandbox · evaluator · engine · assertions · screens | 14 |
| P5 | wizard preview · create · compute · warnings · transitions · screens · payslip detail · PDF · mail | 16 |
| P6 | kpis · by-department · trend · alerts · attendance overview · timeoff overview · screen | 9 |
| P7 | seed · scenarios · polish · README · roadmap | 8 |

**Checkpoint rule:** a checkpoint is only complete when it type-checks, the affected route answers, and the commit is pushed. A red checkpoint blocks the next one in that lane.

## Handoff contract

Every agent brief states: the files it may write, the `shared/` types it must compile against, the business rules by ID from the system design plan (C1, T2, P1 …), the guardrails it must implement, and its definition of done. Agents return a summary — the controller reviews the diff, then commits. **Agents never commit or push.**

## Rollback

Each phase ends at a pushed commit, so a bad lane resets with `git reset --hard <last green checkpoint>`. No force-pushes after P0 except to correct authorship.
