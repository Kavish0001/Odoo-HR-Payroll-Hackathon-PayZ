/**
 * The abstract line diagram from the hero: Employee to Attendance to Payroll
 * to Payslip, drawn as connected nodes over the dotted grid.
 *
 * It is the product's actual argument in one picture. Those four records are
 * separate systems in most HR tools, and the point of PayZ is that they are
 * one chain, so the diagram draws the chain rather than decorating the page.
 */

const NODES = [
  { x: 60, y: 210, label: 'EMPLOYEE' },
  { x: 190, y: 110, label: 'ATTENDANCE' },
  { x: 320, y: 210, label: 'PAYROLL' },
  { x: 450, y: 110, label: 'PAYSLIP' },
] as const;

export function FlowDiagram(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 520 300"
      className="h-auto w-full"
      role="img"
      aria-label="Employee flows to Attendance, then Payroll, then Payslip"
    >
      <defs>
        <pattern
          id="landing-dots"
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1.5" cy="1.5" r="1.5" fill="var(--color-steel-300)" />
        </pattern>
      </defs>

      <rect
        x="0"
        y="0"
        width="520"
        height="300"
        fill="url(#landing-dots)"
        opacity="0.75"
      />

      {/* Structural lines, drawn behind the nodes. */}
      <g stroke="var(--color-steel-300)" strokeWidth="1" fill="none">
        <path d="M60 210 L190 110 L320 210 L450 110" />
        <path d="M190 110 L190 262 M320 210 L320 58" />
        <polygon points="320,34 344,58 320,82 296,58" />
        <circle cx="190" cy="262" r="10" />
        <path d="M60 210 L60 58 L296 58" strokeDasharray="3 5" />
      </g>

      {/* Nodes. The last one is the payslip: the only red in the picture, and
          the thing the whole chain exists to produce. */}
      {NODES.map((node, index) => {
        const isLast = index === NODES.length - 1;
        return (
          <g key={node.label}>
            <circle
              cx={node.x}
              cy={node.y}
              r="13"
              fill="var(--color-steel-50)"
              stroke={isLast ? 'var(--color-signal)' : 'var(--color-ink)'}
              strokeWidth={isLast ? 2 : 1}
            />
            {isLast && (
              <circle
                cx={node.x}
                cy={node.y}
                r="4"
                fill="var(--color-signal)"
              />
            )}
            <text
              x={node.x}
              y={node.y + 34}
              textAnchor="middle"
              className="font-mono"
              fontSize="9"
              letterSpacing="1.4"
              fill="var(--color-muted)"
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
