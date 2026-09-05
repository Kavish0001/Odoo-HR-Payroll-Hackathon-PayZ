import { forwardRef, type SelectHTMLAttributes } from 'react';

import { cn } from '../../lib/utils.js';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly SelectOption[];
  /** Rendered as the disabled first option, for "no selection yet". */
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, options, placeholder, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'border-steel-300 bg-raised w-full rounded-sm border px-3 py-2 text-sm outline-none',
          'focus:border-signal disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  },
);
