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
    <article className="rounded-[1.15rem] border border-border bg-card px-4 py-3.5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="display mt-1.5 text-[1.7rem] font-semibold leading-none tracking-[-0.04em]">{value}</p>
      {hint ? <p className="mt-1.5 text-[11px] leading-4 text-muted">{hint}</p> : null}
    </article>
  );
}

export function MetricBoard({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string | number; hint?: string }[];
}) {
  return (
    <section className="overflow-hidden rounded-[1.25rem] border border-border bg-card">
      <p className="border-b border-border px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="bg-card px-5 py-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">{item.label}</p>
            <p className="display mt-2 text-[1.7rem] font-semibold leading-none tracking-[-0.045em]">{item.value}</p>
            {item.hint ? <p className="mt-1.5 text-[11px] leading-4 text-muted">{item.hint}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function MetricStrip({
  items,
  variant = "strip",
}: {
  items: { label: string; value: string | number; hint?: string }[];
  variant?: "strip" | "kpi";
}) {
  const columns =
    items.length >= 4 ? "grid-cols-2 lg:grid-cols-4" : items.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2";

  return (
    <section className={`grid gap-px overflow-hidden rounded-[17px] border border-border bg-border ${columns}`}>
      {items.map((item) =>
        variant === "kpi" ? (
          <article key={item.label} className="grid min-h-[120px] gap-3 bg-card px-[22px] py-[22px] lg:min-h-[145px]">
            <span className="text-[11px] font-extrabold text-muted">{item.label}</span>
            <strong className="display text-[clamp(1.9rem,4vw,2.6rem)] font-semibold leading-none tracking-[-0.05em]">
              {item.value}
            </strong>
            {item.hint ? <small className="text-[11px] font-extrabold text-muted">{item.hint}</small> : null}
          </article>
        ) : (
          <div key={item.label} className="grid gap-1.5 bg-card px-[22px] py-5">
            <strong className="display text-[29px] font-semibold leading-none tracking-[-0.04em]">{item.value}</strong>
            <span className="text-[11px] text-muted">{item.label}</span>
            {item.hint ? <span className="text-[11px] text-muted">{item.hint}</span> : null}
          </div>
        ),
      )}
    </section>
  );
}
