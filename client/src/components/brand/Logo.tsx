interface LogoProps {
  /** Rendered size in pixels. */
  size?: number;
  /** Show the PayZ wordmark beside the coin. */
  withWordmark?: boolean;
  className?: string;
}

/**
 * The PayZ coin.
 *
 * The coin, at every size. One asset for the favicon, the navbar, the login
 * screen and the PDF alike: a logo that changes shape between places is not
 * a logo.
 */
export function Logo({
  size = 32,
  withWordmark = false,
  className,
}: LogoProps): React.JSX.Element {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <img
        src="/payz-logo.svg"
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
