-- Guardrail constraints that Prisma schema syntax cannot express.
--
-- These are the rules from section 10.4 of the design plan that must hold even
-- if application code has a bug. Enforcing them here means a wrong payslip or
-- an overlapping contract is impossible, not merely unlikely.

-- Required for an exclusion constraint that mixes equality (employeeId) with
-- range overlap (the contract dates) in a single GiST index.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- Rule C1: one running contract per employee at any point in time.
-- ---------------------------------------------------------------------------
-- Payroll resolves the contract applicable to a period. If an employee could
-- hold two overlapping RUNNING contracts, that resolution is ambiguous and the
-- payslip is arbitrary. '[]' makes the range inclusive of both end dates, so
-- two contracts that merely touch on the same day still conflict.
-- A NULL endDate is open-ended and overlaps everything after it.
ALTER TABLE "contracts"
  ADD CONSTRAINT "contracts_no_overlapping_running"
  EXCLUDE USING gist (
    "employeeId" WITH =,
    daterange("startDate", "endDate", '[]') WITH &&
  )
  WHERE (status = 'RUNNING');

-- A contract cannot end before it starts.
ALTER TABLE "contracts"
  ADD CONSTRAINT "contracts_dates_ordered"
  CHECK ("endDate" IS NULL OR "endDate" >= "startDate");

-- Wage drives every salary rule. Zero or negative is always a data error.
ALTER TABLE "contracts"
  ADD CONSTRAINT "contracts_wage_positive"
  CHECK ("wageMonthly" > 0);

-- ---------------------------------------------------------------------------
-- Rule A3: at most one open attendance session per employee.
-- ---------------------------------------------------------------------------
-- The check-in widget decides between Check In and Check Out by looking for an
-- open session. Two open sessions make that state undefined and corrupt worked
-- hours for the day.
CREATE UNIQUE INDEX "attendances_one_open_session"
  ON "attendances" ("employeeId")
  WHERE "checkOut" IS NULL;

-- Check-out cannot precede check-in.
ALTER TABLE "attendances"
  ADD CONSTRAINT "attendances_times_ordered"
  CHECK ("checkOut" IS NULL OR "checkOut" >= "checkIn");

-- ---------------------------------------------------------------------------
-- Rule W7: the DUPLICATE_PAYSLIP warning, backed by a real constraint.
-- ---------------------------------------------------------------------------
-- An employee may not be paid twice for the same period. Cancelled payslips are
-- excluded so a corrected run can replace a mistaken one.
CREATE UNIQUE INDEX "payslips_unique_employee_period"
  ON "payslips" ("employeeId", "periodStart", "periodEnd")
  WHERE status <> 'CANCELLED';

-- Period ordering, for payslips and payruns alike.
ALTER TABLE "payslips"
  ADD CONSTRAINT "payslips_period_ordered"
  CHECK ("periodEnd" >= "periodStart");

ALTER TABLE "payruns"
  ADD CONSTRAINT "payruns_period_ordered"
  CHECK ("periodEnd" >= "periodStart");

-- ---------------------------------------------------------------------------
-- Rule S2: schedule lines must describe a real working day.
-- ---------------------------------------------------------------------------
-- Weekly hours are derived by summing (end - start - break) across these lines.
-- A break longer than the day would silently produce negative weekly hours.
ALTER TABLE "schedule_lines"
  ADD CONSTRAINT "schedule_lines_times_valid"
  CHECK (
    "startMinute" >= 0
    AND "endMinute" > "startMinute"
    AND "endMinute" <= 1440
    AND "breakMinutes" >= 0
    AND "breakMinutes" < ("endMinute" - "startMinute")
  );

-- ---------------------------------------------------------------------------
-- Time off: allocations grant balance, requests consume it.
-- ---------------------------------------------------------------------------
ALTER TABLE "time_off_allocations"
  ADD CONSTRAINT "allocations_validity_ordered"
  CHECK ("validTo" IS NULL OR "validTo" >= "validFrom");

-- An allocation of zero or fewer days grants nothing and is a data error.
ALTER TABLE "time_off_allocations"
  ADD CONSTRAINT "allocations_quantity_positive"
  CHECK ("allocatedQty" > 0);

ALTER TABLE "time_off_requests"
  ADD CONSTRAINT "requests_dates_ordered"
  CHECK ("endDate" >= "startDate");

ALTER TABLE "time_off_requests"
  ADD CONSTRAINT "requests_duration_positive"
  CHECK ("duration" > 0);

-- ---------------------------------------------------------------------------
-- Rule P1: sequence drives execution order, so it must be a real ordinal.
-- ---------------------------------------------------------------------------
ALTER TABLE "salary_rules"
  ADD CONSTRAINT "salary_rules_sequence_positive"
  CHECK ("sequence" > 0);

-- A percentage rule outside 0..100 is always a mistake.
ALTER TABLE "salary_rules"
  ADD CONSTRAINT "salary_rules_percentage_range"
  CHECK ("percentage" IS NULL OR ("percentage" >= 0 AND "percentage" <= 100));
