import { useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { ButtonLink } from "./PageChrome";
import { ThemeToggle } from "./ThemeToggle";

export function BrandMark({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="group flex items-center gap-2.5" aria-label="ShareTable home">
      <img
        src="/sharetable-mark.png"
        alt=""
        width={32}
        height={32}
        className="size-8 rounded-[9px] object-contain"
        style={{ backgroundColor: "#f6ecdd" }}
      />
      <span className="text-base font-extrabold tracking-[-0.03em]">ShareTable</span>
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
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-[22px] sm:px-8 lg:px-12">
        <BrandMark />
        {variant === "landing" ? (
          <>
            <nav className="hidden items-center gap-7 text-[13px] font-bold text-muted md:flex" aria-label="Main navigation">
              {landingLinks.map((item) => (
                <a key={item.href} href={item.href} className="transition-colors hover:text-foreground">
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="hidden items-center gap-4 md:flex">
              <ThemeToggle />
              <Link to="/login" className="text-[13px] font-bold text-foreground">
                Log in
              </Link>
              <ButtonLink to="/register?role=DONOR" className="min-h-[38px] px-4">
                Get started <ArrowRight className="size-4" />
              </ButtonLink>
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
                  <div className="px-1 py-2">
                    <ThemeToggle />
                  </div>
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-secondary"
                  >
                    Log in
                  </Link>
                  <ButtonLink to="/register?role=DONOR" className="mt-2">
                    Get started <ArrowRight className="size-4" />
                  </ButtonLink>
                </nav>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-3">
            <ThemeToggle compact />
            <Link to="/login" className="hidden text-[13px] font-bold sm:inline">
              Log in
            </Link>
            <ButtonLink to="/register" className="min-h-[38px] px-4">
              Register
            </ButtonLink>
          </div>
        )}
      </div>
    </header>
  );
}
