import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib/utils.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * Buttons are machined edges, not soft chips: hairline border, square-ish
 * corners, monospace label so they read as controls rather than prose.
 *
 * Red is reserved for destructive actions only. The primary action is ink on
 * white, which keeps the accent meaningful everywhere else on the page.
 */
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-steel-50 border border-ink hover:bg-ink/85',
  secondary: 'border border-steel-300 bg-raised text-ink hover:bg-steel-100',
  ghost: 'border border-transparent text-ink hover:bg-steel-100',
  danger: 'border border-signal bg-signal text-white hover:bg-danger-strong',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-[11px]',
  md: 'px-3.5 py-2 text-xs',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = 'primary', size = 'md', type = 'button', ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'font-mono inline-flex items-center justify-center gap-1.5 rounded-sm font-medium tracking-wide uppercase whitespace-nowrap transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-40',
          VARIANT_CLASS[variant],
          SIZE_CLASS[size],
          className,
        )}
        {...props}
      />
    );
  },
);
