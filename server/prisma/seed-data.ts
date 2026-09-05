import { type EmployeeType, type RuleCategory } from '@payz/shared';

/**
 * The demo roster and payroll configuration.
 *
 * Split from seed.ts so the data is readable on its own and the seeding logic
 * stays about ordering and relationships.
 *
 * Wages are realistic Indian monthly salaries in integer paise, varied by
 * department and seniority so dashboard aggregates differ meaningfully between
 * departments rather than every bar being the same height.
 */

export interface SeedPerson {
  code: string;
  firstName: string;
  lastName: string;
  department: string;
  position: string;
  /** Monthly wage in paise. */
  wage: number;
  employeeType: EmployeeType;
  schedule: 'full' | 'part' | 'flexible';
  joinYear: number;
  /** Left false for a few people so payroll warnings have real subjects. */
  hasBankDetails: boolean;
  location: string;
}

const lakh = (rupees: number): number => Math.round(rupees * 100);

export const DEPARTMENTS = [
  'Finance',
  'HR',
  'Engineering',
  'Sales',
  'Support',
  'IT',
] as const;

export const JOB_POSITIONS = [
  'Payroll Specialist',
  'Finance Manager',
  'HR Officer',
  'Recruiter',
  'HR Manager',
  'Developer',
  'Senior Developer',
  'Engineering Lead',
  'QA Engineer',
  'Sales Executive',
  'Sales Manager',
  'Support Engineer',
  'Support Lead',
  'IT Administrator',
  'Data Analyst',
  'Intern',
] as const;

export const PEOPLE: SeedPerson[] = [
  // ---- Finance: small, well paid -----------------------------------------
  {
    code: 'EMP001',
    firstName: 'Aarav',
    lastName: 'Mehta',
    department: 'Finance',
    position: 'Payroll Specialist',
    wage: lakh(85_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2022,
    hasBankDetails: true,
    location: 'Mumbai',
  },
  {
    code: 'EMP002',
    firstName: 'Rohan',
    lastName: 'Verma',
    department: 'Finance',
    position: 'Finance Manager',
    wage: lakh(148_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2020,
    hasBankDetails: true,
    location: 'Mumbai',
  },
  {
    code: 'EMP003',
    firstName: 'Ishita',
    lastName: 'Nair',
    department: 'Finance',
    position: 'Data Analyst',
    wage: lakh(72_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2023,
    hasBankDetails: true,
    location: 'Mumbai',
  },

  // ---- HR ------------------------------------------------------------------
  // Sara has no bank details on purpose: the MISSING_BANK_ACCOUNT warning
  // needs a real subject rather than an invented one.
  {
    code: 'EMP004',
    firstName: 'Sara',
    lastName: 'Khan',
    department: 'HR',
    position: 'HR Manager',
    wage: lakh(95_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2019,
    hasBankDetails: false,
    location: 'Mumbai',
  },
  {
    code: 'EMP005',
    firstName: 'Neha',
    lastName: 'Patel',
    department: 'HR',
    position: 'Recruiter',
    wage: lakh(64_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2023,
    hasBankDetails: true,
    location: 'Pune',
  },
  {
    code: 'EMP006',
    firstName: 'Kabir',
    lastName: 'Joshi',
    department: 'HR',
    position: 'HR Officer',
    wage: lakh(58_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2024,
    hasBankDetails: true,
    location: 'Pune',
  },

  // ---- Engineering: largest and most expensive ----------------------------
  {
    code: 'EMP007',
    firstName: 'John',
    lastName: 'Dsouza',
    department: 'Engineering',
    position: 'Developer',
    wage: lakh(72_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2023,
    hasBankDetails: true,
    location: 'Bengaluru',
  },
  {
    code: 'EMP008',
    firstName: 'Priya',
    lastName: 'Raghavan',
    department: 'Engineering',
    position: 'Engineering Lead',
    wage: lakh(185_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2018,
    hasBankDetails: true,
    location: 'Bengaluru',
  },
  {
    code: 'EMP009',
    firstName: 'Arjun',
    lastName: 'Deshpande',
    department: 'Engineering',
    position: 'Senior Developer',
    wage: lakh(132_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2021,
    hasBankDetails: true,
    location: 'Bengaluru',
  },
  {
    code: 'EMP010',
    firstName: 'Meera',
    lastName: 'Iyer',
    department: 'Engineering',
    position: 'Senior Developer',
    wage: lakh(128_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2021,
    hasBankDetails: true,
    location: 'Bengaluru',
  },
  {
    code: 'EMP011',
    firstName: 'Vikram',
    lastName: 'Singh',
    department: 'Engineering',
    position: 'Developer',
    wage: lakh(78_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2022,
    hasBankDetails: true,
    location: 'Bengaluru',
  },
  {
    code: 'EMP012',
    firstName: 'Ananya',
    lastName: 'Bose',
    department: 'Engineering',
    position: 'QA Engineer',
    wage: lakh(66_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2023,
    hasBankDetails: true,
    location: 'Bengaluru',
  },
  {
    code: 'EMP013',
    firstName: 'Rahul',
    lastName: 'Chauhan',
    department: 'Engineering',
    position: 'Developer',
    wage: lakh(74_000),
    employeeType: 'CONTRACT',
    schedule: 'flexible',
    joinYear: 2024,
    hasBankDetails: true,
    location: 'Remote',
  },
  {
    code: 'EMP014',
    firstName: 'Diya',
    lastName: 'Kulkarni',
    department: 'Engineering',
    position: 'Intern',
    wage: lakh(25_000),
    employeeType: 'INTERN',
    schedule: 'part',
    joinYear: 2026,
    hasBankDetails: false,
    location: 'Bengaluru',
  },

  // ---- Sales: largest headcount, mid salaries -----------------------------
  {
    code: 'EMP015',
    firstName: 'Karan',
    lastName: 'Malhotra',
    department: 'Sales',
    position: 'Sales Manager',
    wage: lakh(112_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2020,
    hasBankDetails: true,
    location: 'Delhi',
  },
  {
    code: 'EMP016',
    firstName: 'Sneha',
    lastName: 'Reddy',
    department: 'Sales',
    position: 'Sales Executive',
    wage: lakh(62_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2023,
    hasBankDetails: true,
    location: 'Delhi',
  },
  {
    code: 'EMP017',
    firstName: 'Aditya',
    lastName: 'Kapoor',
    department: 'Sales',
    position: 'Sales Executive',
    wage: lakh(58_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2024,
    hasBankDetails: true,
    location: 'Delhi',
  },
  {
    code: 'EMP018',
    firstName: 'Pooja',
    lastName: 'Agarwal',
    department: 'Sales',
    position: 'Sales Executive',
    wage: lakh(60_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2023,
    hasBankDetails: true,
    location: 'Mumbai',
  },
  {
    code: 'EMP019',
    firstName: 'Nikhil',
    lastName: 'Rao',
    department: 'Sales',
    position: 'Sales Executive',
    wage: lakh(55_000),
    employeeType: 'PART_TIME',
    schedule: 'part',
    joinYear: 2025,
    hasBankDetails: true,
    location: 'Hyderabad',
  },
  {
    code: 'EMP020',
    firstName: 'Tanvi',
    lastName: 'Shah',
    department: 'Sales',
    position: 'Sales Executive',
    wage: lakh(57_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2024,
    hasBankDetails: true,
    location: 'Ahmedabad',
  },

  // ---- Support -------------------------------------------------------------
  {
    code: 'EMP021',
    firstName: 'Farhan',
    lastName: 'Sheikh',
    department: 'Support',
    position: 'Support Lead',
    wage: lakh(88_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2021,
    hasBankDetails: true,
    location: 'Pune',
  },
  {
    code: 'EMP022',
    firstName: 'Riya',
    lastName: 'Menon',
    department: 'Support',
    position: 'Support Engineer',
    wage: lakh(52_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2024,
    hasBankDetails: true,
    location: 'Pune',
  },
  {
    code: 'EMP023',
    firstName: 'Sameer',
    lastName: 'Gupta',
    department: 'Support',
    position: 'Support Engineer',
    wage: lakh(54_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2023,
    hasBankDetails: true,
    location: 'Pune',
  },
  {
    code: 'EMP024',
    firstName: 'Divya',
    lastName: 'Pillai',
    department: 'Support',
    position: 'Support Engineer',
    wage: lakh(50_000),
    employeeType: 'PART_TIME',
    schedule: 'part',
    joinYear: 2025,
    hasBankDetails: true,
    location: 'Kochi',
  },

  // ---- IT ------------------------------------------------------------------
  {
    code: 'EMP025',
    firstName: 'Manish',
    lastName: 'Tiwari',
    department: 'IT',
    position: 'IT Administrator',
    wage: lakh(76_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2022,
    hasBankDetails: true,
    location: 'Mumbai',
  },
  {
    code: 'EMP026',
    firstName: 'Zoya',
    lastName: 'Ansari',
    department: 'IT',
    position: 'IT Administrator',
    wage: lakh(70_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2023,
    hasBankDetails: true,
    location: 'Mumbai',
  },
  {
    code: 'EMP027',
    firstName: 'Harsh',
    lastName: 'Bhatt',
    department: 'IT',
    position: 'Data Analyst',
    wage: lakh(82_000),
    employeeType: 'FULL_TIME',
    schedule: 'full',
    joinYear: 2022,
    hasBankDetails: true,
    location: 'Ahmedabad',
  },
  {
    code: 'EMP028',
    firstName: 'Lakshmi',
    lastName: 'Krishnan',
    department: 'IT',
    position: 'Intern',
    wage: lakh(22_000),
    employeeType: 'INTERN',
    schedule: 'part',
    joinYear: 2026,
    hasBankDetails: true,
    location: 'Chennai',
  },
];

/** Who manages whom, by employee code. */
export const MANAGERS: Record<string, string> = {
  EMP001: 'EMP002',
  EMP003: 'EMP002',
  EMP005: 'EMP004',
  EMP006: 'EMP004',
  EMP007: 'EMP008',
  EMP009: 'EMP008',
  EMP010: 'EMP008',
  EMP011: 'EMP008',
  EMP012: 'EMP008',
  EMP013: 'EMP008',
  EMP014: 'EMP009',
  EMP016: 'EMP015',
  EMP017: 'EMP015',
  EMP018: 'EMP015',
  EMP019: 'EMP015',
  EMP020: 'EMP015',
  EMP022: 'EMP021',
  EMP023: 'EMP021',
  EMP024: 'EMP021',
  EMP026: 'EMP025',
  EMP027: 'EMP025',
  EMP028: 'EMP025',
};

export interface SeedRule {
  code: string;
  name: string;
  category: RuleCategory;
  sequence: number;
  computationType: 'FIXED' | 'PERCENTAGE' | 'FORMULA';
  fixedAmount?: number;
  percentage?: number;
  percentageBase?: 'CONTRACT_WAGE' | 'BASIC' | 'GROSS' | 'RULE';
  formula?: string;
}

/**
 * The Regular Salary structure, using the exact codes and sequences from the
 * wireframe. Sequence gaps are deliberate: inserting a rule later should not
 * require renumbering everything after it.
 *
 * All three computation methods appear, because the point of the exercise is
 * that salary rules actually drive the payslip.
 */
export const REGULAR_SALARY_RULES: SeedRule[] = [
  {
    code: 'BASIC',
    name: 'Basic Salary',
    category: 'BASIC',
    sequence: 1,
    computationType: 'PERCENTAGE',
    percentage: 50,
    percentageBase: 'CONTRACT_WAGE',
  },
  {
    code: 'HRA',
    name: 'House Rent Allowance',
    category: 'ALLOWANCE',
    sequence: 10,
    computationType: 'PERCENTAGE',
    percentage: 40,
    percentageBase: 'BASIC',
  },
  {
    code: 'STD',
    name: 'Standard Allowance',
    category: 'ALLOWANCE',
    sequence: 20,
    computationType: 'FIXED',
    fixedAmount: lakh(4_167),
  },
  // Seniority-scaled, which is exactly the case fixed and percentage cannot
  // express and formulas exist for.
  {
    code: 'BONUS',
    name: 'Performance Bonus',
    category: 'ALLOWANCE',
    sequence: 30,
    computationType: 'FORMULA',
    formula:
      "result = rules['BASIC'] * Math.min(employee.seniorityYears, 5) * 0.01",
  },
  {
    code: 'LTA',
    name: 'Leave Travel Allowance',
    category: 'ALLOWANCE',
    sequence: 40,
    computationType: 'PERCENTAGE',
    percentage: 8,
    percentageBase: 'BASIC',
  },
  {
    code: 'FIX',
    name: 'Fixed Allowance',
    category: 'ALLOWANCE',
    sequence: 50,
    computationType: 'FIXED',
    fixedAmount: lakh(2_000),
  },
  // Overtime at 1.5x the hourly rate, derived from the hours Attendance
  // actually recorded. This is what makes payroll depend on time tracking
  // rather than being a fixed monthly repeat.
  {
    code: 'OT',
    name: 'Overtime Allowance',
    category: 'ALLOWANCE',
    sequence: 55,
    computationType: 'FORMULA',
    formula:
      "result = rules['BASIC'] / 22 / 8 * (worked.overtimeMinutes / 60) * 1.5",
  },
  {
    code: 'GROSS',
    name: 'Gross Salary',
    category: 'GROSS',
    sequence: 60,
    computationType: 'FIXED',
    fixedAmount: 0,
  },
  {
    code: 'LWF',
    name: 'Labour Welfare Fund',
    category: 'DEDUCTION',
    sequence: 70,
    computationType: 'FIXED',
    fixedAmount: lakh(25),
  },
  // Loss of pay for unpaid leave days, prorated on a 22-day month.
  {
    code: 'LOP',
    name: 'Loss of Pay',
    category: 'DEDUCTION',
    sequence: 75,
    computationType: 'FORMULA',
    formula: "result = rules['BASIC'] / 22 * worked.leaveDays",
  },
  // Provident fund is capped, as it is in practice: 12% of basic, but never
  // more than 1,800 a month.
  {
    code: 'PF',
    name: 'Provident Fund',
    category: 'DEDUCTION',
    sequence: 80,
    computationType: 'FORMULA',
    formula: "result = Math.min(rules['BASIC'] * 0.12, 180000)",
  },
  {
    code: 'ESIC',
    name: 'ESIC',
    category: 'DEDUCTION',
    sequence: 90,
    computationType: 'FORMULA',
    formula:
      "result = categories['GROSS'] <= 2100000 ? categories['GROSS'] * 0.0075 : 0",
  },
  {
    code: 'PT',
    name: 'Professional Tax',
    category: 'DEDUCTION',
    sequence: 100,
    computationType: 'FIXED',
    fixedAmount: lakh(200),
  },
  {
    code: 'NET',
    name: 'Net Salary',
    category: 'NET',
    sequence: 110,
    computationType: 'FIXED',
    fixedAmount: 0,
  },
];

/** A shorter structure for interns, to prove structures actually differ. */
export const INTERN_SALARY_RULES: SeedRule[] = [
  {
    code: 'STIPEND',
    name: 'Monthly Stipend',
    category: 'BASIC',
    sequence: 1,
    computationType: 'PERCENTAGE',
    percentage: 100,
    percentageBase: 'CONTRACT_WAGE',
  },
  {
    code: 'TRAVEL',
    name: 'Travel Allowance',
    category: 'ALLOWANCE',
    sequence: 10,
    computationType: 'FIXED',
    fixedAmount: lakh(1_500),
  },
  {
    code: 'GROSS',
    name: 'Gross Stipend',
    category: 'GROSS',
    sequence: 60,
    computationType: 'FIXED',
    fixedAmount: 0,
  },
  {
    code: 'PT',
    name: 'Professional Tax',
    category: 'DEDUCTION',
    sequence: 100,
    computationType: 'FIXED',
    fixedAmount: lakh(200),
  },
  {
    code: 'NET',
    name: 'Net Stipend',
    category: 'NET',
    sequence: 110,
    computationType: 'FIXED',
    fixedAmount: 0,
  },
];

export const TIME_OFF_TYPES = [
  {
    name: 'Paid Time Off',
    code: 'PTO',
    unit: 'DAYS' as const,
    requiresAllocation: true,
    approvalLevel: 'MANAGER' as const,
    payrollWorkEntry: 'Leave Work Entry',
    isPaid: true,
    color: 'info',
  },
  {
    name: 'Sick Leave',
    code: 'SICK',
    unit: 'DAYS' as const,
    requiresAllocation: false,
    approvalLevel: 'MANAGER' as const,
    payrollWorkEntry: 'Sick Work Entry',
    isPaid: true,
    color: 'warning',
  },
  {
    name: 'Comp Off',
    code: 'COMP',
    unit: 'HOURS' as const,
    requiresAllocation: true,
    approvalLevel: 'OFFICER' as const,
    payrollWorkEntry: null,
    isPaid: true,
    color: 'success',
  },
  {
    name: 'Unpaid Leave',
    code: 'UNPAID',
    unit: 'DAYS' as const,
    requiresAllocation: false,
    approvalLevel: 'MANAGER' as const,
    payrollWorkEntry: 'Unpaid Work Entry',
    isPaid: false,
    color: 'neutral',
  },
];

/**
 * Deterministic pseudo-random source.
 *
 * Attendance and leave need variation to be worth analysing, but a seed that
 * produces different numbers on every run makes "the dashboard changed"
 * impossible to interpret. Same seed, same database, every time.
 */
export function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}
