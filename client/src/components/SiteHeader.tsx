import { useState } from "react";
import { ArrowRight, Menu, UtensilsCrossed, X } from "lucide-react";
import { Link } from "react-router-dom";

export function BrandMark({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="group flex items-center gap-2.5" aria-label="ShareTable home">
      <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(15,23,42,0.2)] transition-transform group-hover:-rotate-3">
        <UtensilsCrossed className="size-5" strokeWidth={2.3} />
      </span>
      <span className="font-display text-xl font-semibold tracking-tight">ShareTable</span>
    </Link>
  );
}

const landingLinks = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Our impact", href: "#impact" },
];

export function SiteHeader({ variant = "landing" }: { variant?: "landing" | "auth" }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
      <BrandMark />
      {variant === "landing" ? (
        <>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
            {landingLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-muted transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/login"
              className="rounded-full px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Log in
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90"
            >
              Get started <ArrowRight className="size-4" />
            </Link>
          </div>
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="rounded-xl p-2 md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
          {menuOpen && (
            <div className="absolute left-5 right-5 top-full z-20 mt-2 rounded-2xl border border-border bg-card p-4 shadow-lg md:hidden">
              <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
                {landingLinks.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-secondary"
                  >
                    {item.label}
                  </a>
                ))}
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-secondary"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMenuOpen(false)}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
                >
                  Get started <ArrowRight className="size-4" />
                </Link>
              </nav>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="rounded-full px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90"
          >
            Register
          </Link>
        </div>
      )}
    </header>
  );
}
