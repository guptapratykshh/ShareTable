import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "./SiteHeader";
import { ThemeToggle } from "./ThemeToggle";
import { buttonStyles } from "./PageChrome";
import { api } from "../services/api";
import type { PublicImpact } from "../types";

export { buttonStyles };

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-extrabold text-foreground">
      {label}
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-[10px] border border-border bg-background px-[15px] py-3.5 text-[13px] font-normal outline-none transition focus:border-accent focus:ring-3 focus:ring-accent/20";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonStyles }) {
  return <button className={`${buttonStyles[variant]} ${className}`} {...props} />;
}

export function AuthShell({
  eyebrow = "Community-powered food rescue",
  asideTitle,
  asideBody,
  cardEyebrow,
  title,
  subtitle,
  switchLabel,
  switchTo,
  switchCta,
  children,
}: {
  eyebrow?: string;
  asideTitle: ReactNode;
  asideBody: string;
  cardEyebrow?: string;
  title: string;
  subtitle: string;
  switchLabel: string;
  switchTo: string;
  switchCta: string;
  children: ReactNode;
}) {
  const [rescued, setRescued] = useState<number | null>(null);

  useEffect(() => {
    api<PublicImpact>("/api/impact")
      .then((data) => setRescued(data.mealsRescued))
      .catch(() => setRescued(0));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between pt-7">
          <BrandMark />
          <div className="flex items-center gap-3 sm:gap-4">
            <ThemeToggle compact />
            <span className="hidden text-xs text-muted sm:inline">{switchLabel}</span>
            <Link to={switchTo} className={`${buttonStyles.primary} min-h-[38px] px-4`}>
              {switchCta} <span aria-hidden>→</span>
            </Link>
          </div>
        </header>

        <section className="grid min-h-[calc(100vh-100px)] items-center gap-10 py-10 lg:grid-cols-[minmax(280px,0.75fr)_minmax(380px,500px)] lg:gap-[clamp(4rem,12vw,11rem)] lg:py-16">
          <aside className="max-w-[430px]">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
              <span className="mr-2 inline-block size-2 rounded-full bg-accent align-middle" />
              {eyebrow}
            </p>
            <h1 className="display mt-5 text-[clamp(3.25rem,7vw,5.5rem)] leading-[0.94] tracking-[-0.06em]">
              {asideTitle}
            </h1>
            <p className="mt-5 max-w-[350px] leading-relaxed text-muted">{asideBody}</p>
            <div className="mt-12 flex items-center gap-3.5 border-t border-border pt-5 text-xs leading-5 text-muted">
              <b className="display text-[34px] font-semibold text-foreground">
                {rescued == null ? (
                  <span className="inline-block h-8 w-16 animate-pulse rounded-lg bg-secondary" />
                ) : (
                  rescued.toLocaleString("en-US")
                )}
              </b>
              <span>
                meals already rescued
                <br />
                through ShareTable
              </span>
            </div>
          </aside>

          <div className="w-full rounded-3xl border border-border bg-card p-7 shadow-[16px_18px_0_color-mix(in_srgb,var(--accent)_18%,transparent)] sm:p-11">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">{cardEyebrow ?? title}</p>
            <h2 className="display mt-2.5 max-w-sm text-[clamp(1.85rem,4vw,2.7rem)] leading-[1.02] tracking-[-0.04em]">
              {title}
            </h2>
            <p className="mt-2.5 mb-7 text-sm leading-6 text-muted">{subtitle}</p>
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
