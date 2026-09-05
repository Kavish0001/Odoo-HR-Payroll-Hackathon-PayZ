import {
  formatINR,
  formatINRWords,
  RULE_CATEGORIES,
  RULE_CATEGORY_LABELS,
  type RuleCategory,
} from '@payz/shared';
import {
  Document,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';

import { CoinMark } from './coin-mark.js';
import { payslipFonts } from './fonts.js';

/**
 * The payslip PDF (P10), rendered with `@react-pdf/renderer`.
 *
 * This is the only artefact of the whole system an employee is likely to keep,
 * forward to a landlord, or hand to a bank, so it is laid out as a payslip
 * rather than as a dump of the computation: identification at the top,
 * earnings and deductions side by side, net pay in figures and in words, and
 * a footer that says plainly that nobody signed it.
 *
 * Every figure comes from the stored payslip lines. Nothing is recomputed
 * here — if the PDF and the database could disagree, the PDF would be the
 * version the employee believes.
 */

/** Brushed Steel, sampled for print. */
const PALETTE = {
  ink: '#16181C',
  muted: '#6B7076',
  faint: '#9BA1A7',
  rule: '#C9CED3',
  hairline: '#E4E7EA',
  band: '#EFF1F3',
  mist: '#DFF1F1',
  steel: '#BBD5DA',
  red: '#FF0000',
} as const;

export interface PayslipPdfLine {
  code: string;
  name: string;
  category: RuleCategory;
  sequence: number;
  amount: number;
}

export interface PayslipPdfData {
  companyName: string;
  companyLegalName: string | null;
  number: string;
  payrunName: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  designation: string | null;
  joinDate: string | null;
  bankName: string | null;
  /** Already masked by the loader; the PDF never sees a full account number. */
  bankAccountMasked: string | null;
  bankIfsc: string | null;
  structureName: string;
  periodStart: string;
  periodEnd: string;
  workedDays: number;
  leaveDays: number;
  contractReference: string;
  contractWage: number;
  basicAmount: number;
  allowanceAmount: number;
  grossAmount: number;
  deductionAmount: number;
  netAmount: number;
  lines: readonly PayslipPdfLine[];
}

/**
 * Which side of the payslip a category belongs on.
 *
 * GROSS and NET are on neither. The structures define them as real rules so
 * that later rules can refer to `categories['GROSS']`, but they are subtotals
 * of the lines above, not earnings in their own right. Listing them in the
 * earnings column would show the same money twice and leave the column
 * summing to roughly double the gross.
 */
const EARNING_CATEGORIES = new Set<RuleCategory>(['BASIC', 'ALLOWANCE']);
const DEDUCTION_CATEGORIES = new Set<RuleCategory>(['DEDUCTION']);

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 44,
    paddingHorizontal: 34,
    fontSize: 9,
    color: PALETTE.ink,
    lineHeight: 1.35,
  },

  // Header
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  headerText: { flex: 1, paddingLeft: 12 },
  company: {
    fontSize: 17,
    letterSpacing: -0.4,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  legalName: {
    fontSize: 8,
    color: PALETTE.muted,
    lineHeight: 1.2,
    marginTop: 2,
  },
  headerRight: { alignItems: 'flex-end' },
  docTitle: {
    fontSize: 8,
    letterSpacing: 1.6,
    color: PALETTE.muted,
    fontWeight: 700,
  },
  docNumber: { fontSize: 12, marginTop: 3, fontWeight: 700 },
  period: { fontSize: 8, color: PALETTE.muted, marginTop: 2 },
  redRule: {
    height: 3,
    backgroundColor: PALETTE.red,
    width: 54,
    marginTop: 12,
  },
  steelRule: {
    height: 3,
    backgroundColor: PALETTE.steel,
    marginBottom: 14,
  },

  // Identification panel
  panel: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: PALETTE.rule,
    backgroundColor: PALETTE.band,
  },
  panelCol: { flex: 1, padding: 9 },
  panelDivider: { width: 1, backgroundColor: PALETTE.rule },
  label: {
    fontSize: 6.5,
    letterSpacing: 1,
    color: PALETTE.faint,
    marginBottom: 1,
  },
  value: { fontSize: 9, marginBottom: 6 },

  // Earnings / deductions
  columns: { flexDirection: 'row', marginTop: 14 },
  column: { flex: 1 },
  columnGap: { width: 12 },
  columnHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: PALETTE.ink,
    paddingBottom: 3,
  },
  columnTitle: { fontSize: 7.5, letterSpacing: 1.3, fontWeight: 700 },
  categoryHead: {
    fontSize: 6.5,
    letterSpacing: 1,
    color: PALETTE.muted,
    backgroundColor: PALETTE.mist,
    paddingVertical: 2.5,
    paddingHorizontal: 5,
    marginTop: 6,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.hairline,
    paddingVertical: 3.5,
    paddingHorizontal: 5,
  },
  lineName: { flex: 1, paddingRight: 6 },
  lineCode: { fontSize: 6.5, color: PALETTE.faint, marginTop: 1 },
  lineAmount: { fontSize: 9 },
  columnTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1.5,
    borderTopColor: PALETTE.ink,
    paddingTop: 4,
    paddingHorizontal: 5,
    marginTop: 2,
  },
  empty: {
    fontSize: 8,
    color: PALETTE.faint,
    paddingVertical: 6,
    paddingHorizontal: 5,
  },

  // Net pay
  netBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.mist,
    padding: 11,
    marginTop: 16,
  },
  netLabel: {
    fontSize: 7.5,
    letterSpacing: 1.3,
    color: PALETTE.muted,
    fontWeight: 700,
  },
  netWords: { fontSize: 8, color: PALETTE.ink, marginTop: 3, maxWidth: 330 },
  netFigure: { fontSize: 20, letterSpacing: -0.6, fontWeight: 700 },

  // Reconciliation strip
  strip: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: PALETTE.rule,
    borderTopWidth: 0,
    padding: 8,
  },
  stripCell: { flex: 1 },
  total: { fontWeight: 700 },
  stripValue: { fontSize: 9, marginTop: 1 },

  footer: {
    position: 'absolute',
    bottom: 22,
    left: 34,
    right: 34,
    borderTopWidth: 1,
    borderTopColor: PALETTE.rule,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 6.5, color: PALETTE.faint },
});

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(isoDate));
}

/** Days can be fractional (a half day of leave); trailing zeros are noise. */
function formatDays(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </>
  );
}

/**
 * One side of the payslip.
 *
 * Deduction amounts are stored negative so that net is a plain sum, but a
 * payslip that prints a minus sign under a column already headed DEDUCTIONS
 * reads as a refund. The sign is dropped for display on that side only; the
 * reconciliation strip below still carries it.
 */
function AmountColumn({
  title,
  groups,
  total,
  dropSign,
  fonts,
}: {
  title: string;
  groups: readonly {
    category: RuleCategory;
    lines: readonly PayslipPdfLine[];
  }[];
  total: number;
  dropSign: boolean;
  fonts: { display: string; body: string };
}): React.JSX.Element {
  const show = (amount: number): string =>
    formatINR(dropSign ? Math.abs(amount) : amount);

  return (
    <View style={styles.column}>
      <View style={styles.columnHead}>
        <Text style={[styles.columnTitle, { fontFamily: fonts.display }]}>
          {title}
        </Text>
        <Text style={[styles.columnTitle, { fontFamily: fonts.display }]}>
          AMOUNT
        </Text>
      </View>

      {groups.length === 0 && (
        <Text style={styles.empty}>Nothing under this heading.</Text>
      )}

      {groups.map((group) => (
        <View key={group.category}>
          {/* Only worth a sub-heading when the side actually has more than
              one kind of line to separate. */}
          {groups.length > 1 && (
            <Text style={styles.categoryHead}>
              {RULE_CATEGORY_LABELS[group.category].toUpperCase()}
            </Text>
          )}
          {group.lines.map((line) => (
            <View key={line.code} style={styles.line} wrap={false}>
              <View style={styles.lineName}>
                <Text>{line.name}</Text>
                <Text style={styles.lineCode}>{line.code}</Text>
              </View>
              <Text style={[styles.lineAmount, { fontFamily: fonts.display }]}>
                {show(line.amount)}
              </Text>
            </View>
          ))}
        </View>
      ))}

      <View style={styles.columnTotal}>
        <Text style={[styles.total, { fontFamily: fonts.display }]}>TOTAL</Text>
        <Text style={[styles.total, { fontFamily: fonts.display }]}>
          {show(total)}
        </Text>
      </View>
    </View>
  );
}

export function PayslipDocument({
  data,
}: {
  data: PayslipPdfData;
}): React.JSX.Element {
  const fonts = payslipFonts();

  const grouped = RULE_CATEGORIES.map((category) => ({
    category,
    lines: data.lines
      .filter((line) => line.category === category)
      .sort((a, b) => a.sequence - b.sequence),
  })).filter((group) => group.lines.length > 0);

  const earnings = grouped.filter((group) =>
    EARNING_CATEGORIES.has(group.category),
  );
  const deductions = grouped.filter((group) =>
    DEDUCTION_CATEGORIES.has(group.category),
  );

  const periodLabel = `${formatDate(data.periodStart)} to ${formatDate(data.periodEnd)}`;

  return (
    <Document
      title={`Payslip ${data.number}`}
      author={data.companyName}
      subject={`Salary slip for ${periodLabel}`}
      creator="PayZ Payroll"
      producer="PayZ Payroll"
    >
      <Page size="A4" style={[styles.page, { fontFamily: fonts.body }]}>
        <View style={styles.header}>
          <CoinMark size={44} />

          <View style={styles.headerText}>
            <Text style={[styles.company, { fontFamily: fonts.display }]}>
              {data.companyName}
            </Text>
            {data.companyLegalName !== null && (
              <Text style={styles.legalName}>{data.companyLegalName}</Text>
            )}
          </View>

          <View style={styles.headerRight}>
            <Text style={[styles.docTitle, { fontFamily: fonts.display }]}>
              SALARY SLIP
            </Text>
            <Text style={[styles.docNumber, { fontFamily: fonts.display }]}>
              {data.number}
            </Text>
            <Text style={styles.period}>{periodLabel}</Text>
          </View>
        </View>

        <View style={styles.redRule} />
        <View style={styles.steelRule} />

        <View style={styles.panel}>
          <View style={styles.panelCol}>
            <Field label="EMPLOYEE" value={data.employeeName} />
            <Field label="EMPLOYEE CODE" value={data.employeeCode} />
            <Field label="DESIGNATION" value={data.designation ?? '—'} />
          </View>
          <View style={styles.panelDivider} />

          <View style={styles.panelCol}>
            <Field label="DEPARTMENT" value={data.departmentName ?? '—'} />
            <Field
              label="DATE OF JOINING"
              value={data.joinDate === null ? '—' : formatDate(data.joinDate)}
            />
            <Field label="SALARY STRUCTURE" value={data.structureName} />
          </View>
          <View style={styles.panelDivider} />

          <View style={styles.panelCol}>
            <Field label="CONTRACT" value={data.contractReference} />
            <Field label="MONTHLY WAGE" value={formatINR(data.contractWage)} />
            <Field
              label="DAYS WORKED / LEAVE"
              value={`${formatDays(data.workedDays)} / ${formatDays(data.leaveDays)}`}
            />
          </View>
          <View style={styles.panelDivider} />

          <View style={styles.panelCol}>
            <Field label="BANK" value={data.bankName ?? '—'} />
            <Field
              label="ACCOUNT"
              value={data.bankAccountMasked ?? 'Not on file'}
            />
            <Field label="IFSC" value={data.bankIfsc ?? '—'} />
          </View>
        </View>

        <View style={styles.columns}>
          <AmountColumn
            title="EARNINGS"
            groups={earnings}
            total={data.grossAmount}
            dropSign={false}
            fonts={fonts}
          />
          <View style={styles.columnGap} />
          <AmountColumn
            title="DEDUCTIONS"
            groups={deductions}
            total={data.deductionAmount}
            dropSign
            fonts={fonts}
          />
        </View>

        <View style={styles.netBox} wrap={false}>
          <View>
            <Text style={[styles.netLabel, { fontFamily: fonts.display }]}>
              NET PAY
            </Text>
            <Text style={styles.netWords}>
              {formatINRWords(data.netAmount)}
            </Text>
          </View>
          <Text style={[styles.netFigure, { fontFamily: fonts.display }]}>
            {formatINR(data.netAmount)}
          </Text>
        </View>

        {/* The arithmetic spelled out, so the net above can be checked
            against the columns without a calculator. */}
        <View style={styles.strip} wrap={false}>
          <View style={styles.stripCell}>
            <Text style={styles.label}>BASIC</Text>
            <Text style={[styles.stripValue, { fontFamily: fonts.display }]}>
              {formatINR(data.basicAmount)}
            </Text>
          </View>
          <View style={styles.stripCell}>
            <Text style={styles.label}>ALLOWANCES</Text>
            <Text style={[styles.stripValue, { fontFamily: fonts.display }]}>
              {formatINR(data.allowanceAmount)}
            </Text>
          </View>
          <View style={styles.stripCell}>
            <Text style={styles.label}>GROSS</Text>
            <Text style={[styles.stripValue, { fontFamily: fonts.display }]}>
              {formatINR(data.grossAmount)}
            </Text>
          </View>
          <View style={styles.stripCell}>
            <Text style={styles.label}>DEDUCTIONS</Text>
            <Text style={[styles.stripValue, { fontFamily: fonts.display }]}>
              {formatINR(data.deductionAmount)}
            </Text>
          </View>
          <View style={styles.stripCell}>
            <Text style={styles.label}>NET</Text>
            <Text style={[styles.stripValue, { fontFamily: fonts.display }]}>
              {formatINR(data.netAmount)}
            </Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Computer-generated payslip from PayZ Payroll — valid without a
            signature. Payrun: {data.payrunName}.
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${String(pageNumber)} of ${String(totalPages)}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

/** Renders the payslip to a PDF buffer, ready to stream or attach to email. */
export async function renderPayslipPdf(data: PayslipPdfData): Promise<Buffer> {
  return renderToBuffer(<PayslipDocument data={data} />);
}
