import { RULE_CATEGORY_LABELS, type RuleCategory } from '@payz/shared';

/**
 * Rule category chip.
 *
 * Categories are not statuses and nothing here needs acting on, so none of
 * them take the accent. A deduction is a normal part of a payslip, not an
 * alarm; making it red would spend the one urgent colour on routine
 * configuration and blunt it everywhere it actually matters.
 *
 * Gross and Net are the two totals, so they carry the border and ink weight
 * that separates a summary row from its inputs.
 */
const CATEGORY_CLASS: Record<RuleCategory, string> = {
  BASIC: 'border-steel-300 bg-steel-100 text-ink',
  ALLOWANCE: 'border-steel-300 text-muted',
  GROSS: 'border-ink bg-steel-100 text-ink font-medium',
  DEDUCTION: 'border-steel-300 text-muted',
  NET: 'border-ink bg-ink text-steel-50 font-medium',
};

export function CategoryBadge({
  category,
}: {
  category: RuleCategory;
}): React.JSX.Element {
  return (
    <span
      className={`font-mono inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] tracking-wide uppercase ${CATEGORY_CLASS[category]}`}
    >
      {RULE_CATEGORY_LABELS[category]}
    </span>
  );
}
