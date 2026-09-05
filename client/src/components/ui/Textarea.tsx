import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '../../lib/utils.js';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'border-line focus:border-metal-700 w-full rounded-md border bg-raised px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      />
    );
  },
);
