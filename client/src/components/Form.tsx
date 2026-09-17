import type { ButtonHTMLAttributes, ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15";

const buttonStyles = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60",
  outline:
    "inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-60",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-full border border-alert/25 bg-card px-5 py-3 text-sm font-semibold text-alert transition-colors hover:bg-alert/10 disabled:pointer-events-none disabled:opacity-60",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonStyles }) {
  return <button className={`${buttonStyles[variant]} ${className}`} {...props} />;
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <SiteHeader variant="auth" />
      <div className="mx-auto max-w-lg px-5 pb-16 pt-6 sm:px-8">
        <h1 className="display text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted">{subtitle}</p>
        <div className="mt-6 rounded-[1.5rem] border border-border bg-card p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
          {children}
        </div>
      </div>
    </div>
  );
}
