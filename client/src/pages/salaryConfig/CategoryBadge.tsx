import { RULE_CATEGORY_LABELS, type RuleCategory } from '@payz/shared';

/**
 * Rule category chip. Kept local to this module rather than folded into the
 * shared StatusBadge tone table: NET's "accent-strong" treatment has no
 * `-soft` companion token, so it needs a class combination StatusBadge's
 * Tone union does not model.
 */

const CATEGORY_CLASS: Record<RuleCategory, string> = {
  BASIC: 'bg-info-soft text-info',
  ALLOWANCE: 'bg-success-soft text-success',
  GROSS: 'bg-accent-soft text-accent',
  DEDUCTION: 'bg-danger-soft text-danger',
  NET: 'bg-accent-soft text-accent-strong font-semibold',
};

export function CategoryBadge({
  category,
}: {
  category: RuleCategory;
}): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_CLASS[category]}`}
    >
      {RULE_CATEGORY_LABELS[category]}
    </span>
  );
}
