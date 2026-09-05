import { formatINR, RULE_CATEGORIES, RULE_CATEGORY_LABELS, type RuleCategory } from '@payz/shared';
import {
  Document,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';

/**
 * The payslip PDF (P10-equivalent), rendered with `@react-pdf/renderer`.
 *
 * The self-hosted Space Grotesk / Space Mono faces the client uses are
 * woff2, which `@react-pdf/renderer`'s font system cannot embed (it wants
 * TrueType/OpenType). Registering them would either fail outright or ship a
 * PDF with a silently-substituted font, so this document intentionally uses
 * the built-in Helvetica family instead — always available, no registration
 * step, no risk of a broken glyph table in the printed payslip.
 */

export interface PayslipPdfLine {
  code: string;
  name: string;
  category: RuleCategory;
  sequence: number;
  amount: number;
}

export interface PayslipPdfData {
  companyName: string;
  number: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
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

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1f',
  },
  companyName: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  title: { fontSize: 12, color: '#5b5b66', marginTop: 2 },
  headerRule: {
    borderBottomWidth: 1,
    borderBottomColor: '#d8d8de',
    marginTop: 10,
    marginBottom: 12,
  },
  infoRow: { flexDirection: 'row', marginBottom: 10 },
  infoCol: { flex: 1 },
  infoLabel: {
    fontSize: 8,
    color: '#7a7a86',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  infoValue: { fontSize: 10, marginBottom: 6 },
  table: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#d8d8de',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f0f6',
    borderBottomWidth: 1,
    borderBottomColor: '#d8d8de',
  },
  categoryRow: {
    flexDirection: 'row',
    backgroundColor: '#f8f8fb',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ececf0',
  },
  cellRule: { flex: 3, padding: 5 },
  cellCategory: { flex: 2, padding: 5 },
  cellAmount: { flex: 2, padding: 5, textAlign: 'right', fontFamily: 'Helvetica' },
  cellCode: { flex: 1.5, padding: 5, textAlign: 'right' },
  headerCell: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  categoryLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9, padding: 5 },
  totals: { marginTop: 14, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', width: 220, justifyContent: 'space-between', marginBottom: 3 },
  totalLabel: { fontSize: 10 },
  totalValue: { fontSize: 10, fontFamily: 'Helvetica' },
  netRow: {
    flexDirection: 'row',
    width: 220,
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1f',
    paddingTop: 4,
    marginTop: 4,
  },
  netLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  netValue: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  footer: { marginTop: 24, fontSize: 8, color: '#8a8a94' },
});

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function PayslipDocument({ data }: { data: PayslipPdfData }): React.JSX.Element {
  const linesByCategory = RULE_CATEGORIES.map((category) => ({
    category,
    lines: data.lines
      .filter((line) => line.category === category)
      .sort((a, b) => a.sequence - b.sequence),
  })).filter((group) => group.lines.length > 0);

  return (
    <Document title={`Payslip ${data.number}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.companyName}>{data.companyName}</Text>
        <Text style={styles.title}>Payslip {data.number}</Text>
        <View style={styles.headerRule} />

        <View style={styles.infoRow}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Employee</Text>
            <Text style={styles.infoValue}>
              {data.employeeName} ({data.employeeCode})
            </Text>
            <Text style={styles.infoLabel}>Department</Text>
            <Text style={styles.infoValue}>{data.departmentName ?? '—'}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Pay Period</Text>
            <Text style={styles.infoValue}>
              {formatDate(data.periodStart)} – {formatDate(data.periodEnd)}
            </Text>
            <Text style={styles.infoLabel}>Salary Structure</Text>
            <Text style={styles.infoValue}>{data.structureName}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Contract</Text>
            <Text style={styles.infoValue}>{data.contractReference}</Text>
            <Text style={styles.infoLabel}>Worked / Leave Days</Text>
            <Text style={styles.infoValue}>
              {data.workedDays} / {data.leaveDays}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.cellRule, styles.headerCell]}>Rule</Text>
            <Text style={[styles.cellCategory, styles.headerCell]}>Category</Text>
            <Text style={[styles.cellAmount, styles.headerCell]}>Amount</Text>
            <Text style={[styles.cellCode, styles.headerCell]}>Code</Text>
          </View>

          {linesByCategory.map((group) => (
            <View key={group.category}>
              <View style={styles.categoryRow}>
                <Text style={styles.categoryLabel}>
                  {RULE_CATEGORY_LABELS[group.category]}
                </Text>
              </View>
              {group.lines.map((line) => (
                <View key={line.code} style={styles.row}>
                  <Text style={styles.cellRule}>{line.name}</Text>
                  <Text style={styles.cellCategory}>
                    {RULE_CATEGORY_LABELS[line.category]}
                  </Text>
                  <Text style={styles.cellAmount}>{formatINR(line.amount)}</Text>
                  <Text style={styles.cellCode}>{line.code}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Basic</Text>
            <Text style={styles.totalValue}>{formatINR(data.basicAmount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Allowances</Text>
            <Text style={styles.totalValue}>{formatINR(data.allowanceAmount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Gross</Text>
            <Text style={styles.totalValue}>{formatINR(data.grossAmount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Deductions</Text>
            <Text style={styles.totalValue}>{formatINR(data.deductionAmount)}</Text>
          </View>
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>Net Pay</Text>
            <Text style={styles.netValue}>{formatINR(data.netAmount)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          This is a system-generated payslip from PayZ Payroll. Contract wage
          for this period: {formatINR(data.contractWage)}.
        </Text>
      </Page>
    </Document>
  );
}

/** Renders the payslip to a PDF buffer, ready to stream or attach to email. */
export async function renderPayslipPdf(data: PayslipPdfData): Promise<Buffer> {
  return renderToBuffer(<PayslipDocument data={data} />);
}
