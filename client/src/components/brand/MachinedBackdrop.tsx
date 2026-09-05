/**
 * Faint machined parts drifting behind the application.
 *
 * Gears, bearings, hex fasteners and callout lines, drawn as thin strokes at a
 * few percent opacity and fixed to the viewport. It gives the flat ground the
 * sense of a technical drawing underneath the interface without ever competing
 * with it: nothing here is filled, and nothing is red.
 *
 * Fixed rather than scrolling, so it reads as the surface the app sits on
 * rather than as content that happens to be very light.
 */

/** One gear, built from teeth placed around a circle. */
function Gear({
  cx,
  cy,
  r,
  teeth,
  rotate = 0,
}: {
  cx: number;
  cy: number;
  r: number;
  teeth: number;
  rotate?: number;
}): React.JSX.Element {
  const toothHeight = r * 0.18;
  const marks = Array.from({ length: teeth }, (_, i) => {
    const angle = (i / teeth) * Math.PI * 2;
    const x1 = cx + Math.cos(angle) * r;
    const y1 = cy + Math.sin(angle) * r;
    const x2 = cx + Math.cos(angle) * (r + toothHeight);
    const y2 = cy + Math.sin(angle) * (r + toothHeight);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }).join(' ');

  return (
    <g transform={`rotate(${String(rotate)} ${String(cx)} ${String(cy)})`}>
      <circle cx={cx} cy={cy} r={r} />
      <circle cx={cx} cy={cy} r={r * 0.62} />
      <circle cx={cx} cy={cy} r={r * 0.22} />
      <path d={marks} />
    </g>
  );
}

/** A hex fastener, seen face on. */
function Hex({
  cx,
  cy,
  r,
}: {
  cx: number;
  cy: number;
  r: number;
}): React.JSX.Element {
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
    return `${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`;
  }).join(' ');

  return (
    <g>
      <polygon points={points} />
      <circle cx={cx} cy={cy} r={r * 0.45} />
    </g>
  );
}

export function MachinedBackdrop(): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <svg
        className="text-steel-300 absolute inset-0 h-full w-full opacity-[0.35]"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      >
        {/* Upper right: the main assembly. */}
        <Gear cx={1385} cy={155} r={96} teeth={20} />
        <Gear cx={1530} cy={295} r={54} teeth={14} rotate={9} />
        <Hex cx={1268} cy={296} r={26} />

        {/* Lower left: a bearing and its callouts. */}
        <Gear cx={128} cy={735} r={74} teeth={16} rotate={11} />
        <circle cx={276} cy={815} r={30} />
        <circle cx={276} cy={815} r={14} />
        <path d="M158 660 L232 596 L360 596" />
        <path d="M232 596 L232 566" />

        {/* Centre right: an exploded shaft, drawn as plates on an axis. */}
        <g>
          <path d="M905 690 L1215 690" strokeDasharray="6 6" />
          <rect x="930" y="662" width="26" height="56" />
          <rect x="988" y="650" width="14" height="80" />
          <circle cx={1064} cy={690} r={34} />
          <circle cx={1064} cy={690} r={16} />
          <rect x="1140" y="668" width="34" height="44" />
        </g>

        {/* Sparse hardware, so the corners are not the only busy areas. */}
        <Hex cx={700} cy={168} r={18} />
        <Hex cx={455} cy={330} r={13} />
        <circle cx={820} cy={430} r={9} />
        <circle cx={1180} cy={520} r={6} />

        {/* Dimension lines, the way a drawing annotates a part. */}
        <path d="M60 120 L60 250 M52 120 L68 120 M52 250 L68 250" />
        <path d="M1540 640 L1540 780 M1532 640 L1548 640 M1532 780 L1548 780" />
      </svg>
    </div>
  );
}
