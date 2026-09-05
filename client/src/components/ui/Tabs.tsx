import { cn } from '../../lib/utils.js';

export interface TabItem {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: readonly TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: TabsProps): React.JSX.Element {
  return (
    <div
      role="tablist"
      className={cn('border-line flex gap-1 border-b', className)}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => {
            onChange(tab.key);
          }}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
            active === tab.key
              ? 'border-metal-900 text-ink'
              : 'text-muted hover:text-ink border-transparent',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
