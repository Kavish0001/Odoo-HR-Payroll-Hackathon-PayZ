import { type HTMLAttributes } from 'react';

import { cn } from '../../lib/utils.js';

export type CardProps = HTMLAttributes<HTMLDivElement>;

/**
 * A panel: hairline steel border, white ground, barely-there corners.
 *
 * No shadow anywhere in this system. Depth comes from the border and the
 * tinted fill, the way a machined panel reads against brushed metal.
 */
export function Card({ className, ...props }: CardProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'border-steel-300 bg-raised rounded-sm border p-4',
        className,
      )}
      {...props}
    />
  );
}
