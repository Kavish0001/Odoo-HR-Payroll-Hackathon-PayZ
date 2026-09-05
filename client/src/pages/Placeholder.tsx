/** Stands in until each module's screens land, so routing is testable now. */
export function Placeholder({ title }: { title: string }): React.JSX.Element {
  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted mt-2 text-sm">
        This screen lands in a later phase.
      </p>
    </div>
  );
}
