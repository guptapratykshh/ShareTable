import { ArrowRight, HeartHandshake, MapPin, MoveRight, Package, ShieldCheck, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { ButtonLink } from "../components/PageChrome";
import { api } from "../services/api";
import type { PublicImpact } from "../types";

function compactCount(n: number) {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1000) {
    const k = n / 1000;
    const digits = k >= 10 ? 0 : 1;
    return `${Number.isInteger(k) ? k : k.toFixed(digits).replace(/\.0$/, "")}k`;
  }
  return String(n);
}

function localeCount(n: number) {
  return n.toLocaleString("en-US");
}

function formatRadius(km: number) {
  return `${Number.isInteger(km) ? km : km.toFixed(1).replace(/\.0$/, "")} km`;
}

const steps = [
  {
    number: "01",
    icon: Package,
    title: "Share what you have",
    description: "Messes, kitchens, and events list surplus meals. You type the quantity. Listings expire in one hour.",
  },
  {
    number: "02",
    icon: MapPin,
    title: "We match nearby",
    description: "Registered recipients within the starting radius are notified. The radius can expand if food is still waiting.",
  },
  {
    number: "03",
    icon: HeartHandshake,
    title: "Pickup is confirmed in person",
    description: "The collector shows a pickup code at the door. Only a recorded handoff counts as rescued.",
  },
];

function MetricValue({ ready, children }: { ready: boolean; children: string }) {
  if (!ready) {
    return <span className="inline-block h-8 w-16 animate-pulse rounded-xl bg-secondary" aria-hidden />;
  }
  return <>{children}</>;
}

export function LandingPage() {
  const [impact, setImpact] = useState<PublicImpact | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<PublicImpact>("/api/impact")
      .then((data) => {
        if (!cancelled) setImpact(data);
      })
      .catch(() => {
        if (!cancelled) {
          setImpact({
            mealsRescued: 0,
            mealsRescuedThisWeek: 0,
            totalDonors: 0,
            totalNgos: 0,
            defaultRadiusKm: 2.5,
            listingWindowHours: 1,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const mealsRescued = impact?.mealsRescued ?? 0;
  const totalDonors = impact?.totalDonors ?? 0;
  const totalNgos = impact?.totalNgos ?? 0;
  const radiusKm = impact?.defaultRadiusKm ?? 2.5;
  const listingHours = impact?.listingWindowHours ?? 1;
  const radiusLabel = formatRadius(radiusKm);
  const windowLabel = listingHours === 1 ? "1 hour" : `${listingHours} hours`;
  const ready = impact !== null;

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <SiteHeader />

      <section id="top" className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-16 pt-16 sm:px-8 lg:grid-cols-[1fr_0.76fr] lg:gap-[90px] lg:px-12 lg:pb-24 lg:pt-[105px]">
        <div className="max-w-[535px]">
          <p className="mb-5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">
            <span className="mr-2 inline-block size-2 rounded-full bg-accent align-middle" /> A better way to share food
          </p>
          <h1 className="display text-[clamp(3.25rem,7vw,5.1rem)] leading-[0.92] tracking-[-0.055em]">
            Don't waste food. <em className="not-italic text-accent">Rescue it.</em>
          </h1>
          <p className="mt-6 max-w-[470px] text-base leading-[1.7] text-muted">
            ShareTable connects surplus meals with registered recipients nearby. Matching is distance, never a judgment of need.
          </p>
          <div className="mt-8 flex flex-wrap gap-2.5">
            <ButtonLink to="/register?role=DONOR">
              Donate food <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink to="/register?role=RECIPIENT" variant="outline">
              Find food <MapPin className="size-4" />
            </ButtonLink>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-bold text-muted">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-3.5" /> Pickup confirmed in person
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPin className="size-3.5" /> {radiusLabel} matching
            </span>
            <span className="inline-flex items-center gap-2">
              <Timer className="size-3.5" /> {listingHours}-hour listings
            </span>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-secondary p-[17px] shadow-[18px_20px_0_color-mix(in_srgb,var(--accent)_25%,transparent)]">
          <div className="flex items-center justify-between px-1 pb-3 text-xs font-extrabold">
            <span className="inline-flex items-center gap-2">
              <i className="size-1.5 rounded-full bg-accent" /> Live in your neighborhood
            </span>
            <strong className="rounded-full bg-card px-2.5 py-1 text-[10px] font-extrabold">Live</strong>
          </div>
          <div className="relative min-h-[285px] overflow-hidden rounded-[18px] bg-[#173b32] p-6 text-[#fffaf2] dark:bg-[#171a17]">
            <div className="absolute -right-14 -top-12 size-44 rounded-full border-[18px] border-mint/20" />
            <div className="absolute -bottom-24 -left-20 size-56 rounded-full border-[18px] border-mint/20" />
            <p className="relative z-10 text-xs font-bold text-mint">Only picked-up meals</p>
            <h2 className="relative z-10 mt-2 display text-[42px] leading-[0.92]">
              count as
              <br />
              <span className="text-accent">rescued.</span>
            </h2>
            <div className="relative z-10 mt-16">
              <p className="display text-[58px] leading-none">
                {ready ? compactCount(mealsRescued) : <span className="inline-block h-12 w-24 animate-pulse rounded-xl bg-white/10" />}
              </p>
              <p className="mt-2 text-[11px] text-mint">meals rescued</p>
            </div>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1 rounded-[13px] bg-card px-3.5 py-4">
              <span className="text-[10px] text-muted">Rescue window</span>
              <b className="display text-[17px]">{windowLabel}</b>
            </div>
            <div className="flex flex-col gap-1 rounded-[13px] bg-card px-3.5 py-4">
              <span className="text-[10px] text-muted">Starting radius</span>
              <b className="display text-[17px]">{radiusLabel}</b>
            </div>
          </div>
        </div>
      </section>

      <section id="impact" className="mx-auto grid max-w-7xl grid-cols-3 gap-5 border-y border-border px-5 py-9 text-center sm:px-8 lg:px-12">
        {[
          [ready ? localeCount(mealsRescued) : "", "meals rescued"],
          [ready ? localeCount(totalDonors) : "", totalDonors === 1 ? "donor" : "donors"],
          [ready ? localeCount(totalNgos) : "", totalNgos === 1 ? "NGO" : "NGOs"],
        ].map(([value, label]) => (
          <div key={label} className="flex flex-col gap-1">
            <b className="display text-[27px]">
              <MetricValue ready={ready}>{value}</MetricValue>
            </b>
            <span className="text-xs text-muted">{label}</span>
          </div>
        ))}
        <p className="col-span-3 mt-3.5 text-xs text-muted">
          Live totals from this platform. Only meals confirmed picked up count as rescued.
        </p>
      </section>

      <section id="how-it-works" className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1fr] lg:gap-[100px] lg:px-12 lg:py-[105px]">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">How a rescue works</p>
          <h2 className="display mt-4 max-w-[400px] text-[45px] leading-[0.98]">From leftover to picked up, in three steps.</h2>
          <p className="mt-5 max-w-[360px] leading-[1.65] text-muted">
            No predicted meal counts. Donors enter the surplus. Recipients nearby claim what they can collect.
          </p>
        </div>
        <div className="border-t border-border">
          {steps.map(({ number, icon: Icon, title, description }) => (
            <article key={number} className="grid grid-cols-[42px_38px_1fr] gap-3 border-b border-border py-[22px]">
              <span className="pt-1 font-mono text-xs">{number}</span>
              <span className="grid size-8 place-items-center rounded-[10px] bg-mint text-[#171a17]">
                <Icon className="size-4" />
              </span>
              <div>
                <h3 className="display mb-2 text-lg tracking-[-0.03em]">{title}</h3>
                <p className="m-0 text-[13px] leading-[1.55] text-muted">{description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="px-5 sm:px-8 lg:px-12">
      <section className="mx-auto mb-5 flex max-w-7xl flex-col items-start justify-between gap-8 rounded-3xl bg-[#473021] px-6 py-11 text-[#f6ecdd] sm:px-12 lg:flex-row lg:items-center">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#efd0bd]">For kitchens and messes</p>
          <h2 className="display mt-3 max-w-[530px] text-[37px] leading-tight">Post surplus before it is thrown away.</h2>
          <p className="mt-3 max-w-[510px] leading-[1.5] text-[#efd0bd]">
            Nearby registered recipients are notified. You confirm pickup only when the collector is at the door.
          </p>
        </div>
        <ButtonLink to="/register?role=DONOR" className="bg-[#f6ecdd] text-[#473021] shadow-none hover:bg-[#fffaf2]">
          Become a donor <MoveRight className="size-4" />
        </ButtonLink>
      </section>

      <section className="mx-auto mb-8 flex max-w-7xl flex-col items-start justify-between gap-8 rounded-3xl border border-border bg-card px-6 py-11 sm:px-12 lg:flex-row lg:items-center">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">For registered recipients</p>
          <h2 className="display mt-3 max-w-[530px] text-[37px] leading-tight">
            Claim what is nearby before the hour is up.
          </h2>
          <p className="mt-3 max-w-[510px] leading-[1.5] text-muted">
            See listings inside the current rescue radius, reserve meals, and show the pickup code in person.
          </p>
        </div>
        <ButtonLink to="/register?role=RECIPIENT" variant="outline">
          Find food <MapPin className="size-4" />
        </ButtonLink>
      </section>
      </div>

      <footer className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-10 text-xs text-muted sm:px-8 lg:px-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="font-extrabold text-foreground">
            ShareTable
          </Link>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <a href="#how-it-works" className="hover:text-foreground">
              How it works
            </a>
            <a href="#impact" className="hover:text-foreground">
              Our impact
            </a>
            <Link to="/login" className="hover:text-foreground">
              Log in
            </Link>
          </nav>
        </div>
        <p className="max-w-xl">
          Donors are responsible for ensuring donated food is safe, properly handled, and suitable for consumption.
          ShareTable only facilitates discovery, claiming, and pickup.
        </p>
      </footer>
    </main>
  );
}
