interface LogoProps {
  /** Rendered size in pixels. Below 48 the simplified mark is used. */
  size?: number;
  /** Show the PayZ wordmark beside the coin. */
  withWordmark?: boolean;
  className?: string;
}

/**
 * The PayZ coin.
 *
 * Two assets, chosen by size: the full coin carries a brush pattern, reeded
 * edge and machining rings that stop reading below roughly 48px, so smaller
 * renders get the simplified mark instead.
 */
export function Logo({
  size = 32,
  withWordmark = false,
  className,
}: LogoProps): React.JSX.Element {
  const source = size >= 48 ? '/payz-icon.svg' : '/payz-mark.svg';

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <img
        src={source}
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      {withWordmark && (
        <span
          className="font-semibold tracking-tight"
          style={{ fontSize: Math.round(size * 0.62) }}
        >
          PayZ
        </span>
      )}
    </span>
  );
}
