import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { ButtonLink } from "../../components/PageChrome";

export function AdminHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">{eyebrow}</p>
        <h1 className="display text-4xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-xl text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function AdminTable({
  columns,
  children,
}: {
  columns: string[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-[1.5rem] border border-border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10 border-b border-border bg-card text-muted">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 font-semibold">
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
    <Link to={to} className="font-semibold text-primary hover:underline">
      {children}
    </Link>
  );
}

export function AdminCreateLink({ to, children }: { to: string; children: ReactNode }) {
  return <ButtonLink to={to}>{children}</ButtonLink>;
}
