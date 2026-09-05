import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '../../lib/utils.js';

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          'border-line accent-metal-900 h-4 w-4 rounded',
          className,
        )}
        {...props}
      />
    );
  },
);
