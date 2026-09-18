import type { ReactNode } from "react";
import { ButtonLink, PageHeader } from "../../components/PageChrome";
import { Link } from "react-router-dom";

export function AdminHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} actions={actions} />;
}

export function AdminTable({
  columns,
  children,
}: {
  columns: string[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-[20px] border border-border bg-card">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="sticky top-0 z-10 border-b border-border bg-card text-[11px] uppercase tracking-[0.08em] text-muted">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-4 py-4 font-semibold">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function AdminLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-semibold text-foreground hover:text-accent">
      {children}
    </Link>
  );
}

export function AdminCreateLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <ButtonLink to={to}>
      {children} <span aria-hidden>→</span>
    </ButtonLink>
  );
}

export function AdminToolbar({ children }: { children: ReactNode }) {
  return <section className="flex flex-wrap gap-2.5">{children}</section>;
}

export const adminSearchClass =
  "min-w-[200px] flex-1 rounded-[10px] border border-border bg-card px-3.5 py-3 text-xs outline-none transition focus:border-accent focus:ring-3 focus:ring-accent/20";

export function AdminFilterButton({
  children,
  active = false,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[10px] border px-3.5 py-3 text-xs font-bold transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function AdminPanel({
  children,
  accent = false,
  className = "",
}: {
  children: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[20px] border border-border p-6 ${
        accent ? "bg-[color-mix(in_srgb,var(--accent)_11%,var(--card))]" : "bg-card"
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function AdminFormCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[720px] rounded-[22px] border border-border bg-card p-8">
      <div className="mb-8">
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
          <span className="mr-2 inline-block size-2 rounded-full bg-accent align-middle" />
          Create record
        </p>
        <h2 className="display text-[27px] tracking-[-0.04em]">{title}</h2>
        <p className="mt-2.5 text-[13px] leading-6 text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function AdminField({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`grid gap-2 text-xs font-extrabold ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      {children}
    </label>
  );
}
