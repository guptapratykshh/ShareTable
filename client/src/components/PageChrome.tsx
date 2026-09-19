import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export const buttonStyles = {
  primary:
    "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full bg-primary px-5 text-[13px] font-extrabold text-primary-foreground shadow-[0_8px_18px_#00000055] transition-all hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60",
  outline:
    "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full border border-border bg-transparent px-5 text-[13px] font-extrabold transition-all hover:-translate-y-0.5 hover:border-muted disabled:pointer-events-none disabled:opacity-60",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-extrabold text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-60",
  danger:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-alert/25 bg-card px-5 text-[13px] font-extrabold text-alert transition-colors hover:bg-alert/10 disabled:pointer-events-none disabled:opacity-60",
};

export function ButtonLink({
  to,
  variant = "primary",
  className = "",
  children,
}: {
  to: string;
  variant?: keyof typeof buttonStyles;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={`${buttonStyles[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        {eyebrow ? (
          <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
            <span className="mr-2 inline-block size-2 rounded-full bg-accent align-middle" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="display max-w-3xl text-[clamp(2.5rem,5vw,4.5rem)] font-semibold leading-[0.94] tracking-[-0.055em]">
          {title}
        </h1>
        {subtitle ? <p className="mt-4 max-w-xl text-[15px] leading-6 text-muted">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-border bg-card px-6 py-10 text-center">
      <p className="display text-xl font-semibold tracking-tight">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function CardList({ children }: { children: ReactNode }) {
  return (
    <div className="max-h-[min(32rem,calc(100svh-16rem))] divide-y divide-border overflow-y-auto overscroll-contain rounded-[18px] border border-border bg-card px-4">
      {children}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center" role="status">
      <span className="sr-only">Loading</span>
      <span aria-hidden className="size-11 animate-spin rounded-full border-[3px] border-secondary border-t-accent" />
    </div>
  );
}

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex max-w-full gap-1.5 overflow-x-auto">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`whitespace-nowrap rounded-full border px-3 py-2 text-[11px] font-bold transition-colors ${
            value === option.id
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-transparent text-muted hover:border-primary hover:bg-primary hover:text-primary-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SectionToolbar({
  label,
  meta,
  children,
}: {
  label?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {label ? <b className="text-sm">{label}</b> : null}
        {meta ? <span className="text-[11px] text-muted">{meta}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function IconTile({
  children,
  accent = false,
  className = "",
}: {
  children: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`grid size-9 shrink-0 place-items-center rounded-[11px] text-sm font-black ${
        accent ? "bg-mint text-[#171a17]" : "bg-secondary text-foreground"
      } ${className}`}
    >
      {children}
    </span>
  );
}
