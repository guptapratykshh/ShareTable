export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-border bg-card p-5">
      <p className="display text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
