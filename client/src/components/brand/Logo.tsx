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
        // The red underline is the one place the wordmark carries accent, and
        // it is deliberately short: it underlines the mark, not the page.
        <span className="inline-flex flex-col">
          <span
            className="font-display leading-none font-bold tracking-tight"
            style={{ fontSize: Math.round(size * 0.62) }}
          >
            PayZ
          </span>
          <span
            aria-hidden="true"
            className="bg-signal mt-1 h-[2px] w-7 rounded-full"
          />
        </span>
      )}
    </span>
  );
}
