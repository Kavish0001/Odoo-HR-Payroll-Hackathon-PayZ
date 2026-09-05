import { type HTMLAttributes } from 'react';

import { cn } from '../../lib/utils.js';

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps): React.JSX.Element {
  return (
    <div
      className={cn('border-line bg-raised rounded-lg border', className)}
      {...props}
    />
  );
}
