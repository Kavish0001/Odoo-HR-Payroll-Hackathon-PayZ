import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '../../lib/utils.js';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'border-line focus:border-metal-700 w-full rounded-md border bg-raised px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
});
