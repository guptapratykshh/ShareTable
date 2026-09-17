import {
  ArrowRight,
  HeartHandshake,
  MapPin,
  MoveRight,
  Package,
  ShieldCheck,
  Timer,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
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

function formatWindow(hours: number) {
  return `${hours}-hour`;
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
  const windowShort = formatWindow(listingHours);
  const ready = impact !== null;

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="relative isolate">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_75%_6%,rgba(24,24,27,0.1),transparent_30%),radial-gradient(circle_at_8%_22%,rgba(15,23,42,0.08),transparent_27%)]" />
        <SiteHeader />

        <section
          id="top"
          className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20 lg:px-12 lg:pb-28 lg:pt-24"
        >
          <div className="max-w-2xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              <span className="size-1.5 rounded-full bg-accent" /> A better way to share food
            </div>
            <h1 className="font-display text-[clamp(3.3rem,7vw,6.4rem)] font-semibold leading-[0.93] tracking-[-0.065em]">
              Don't waste food. <span className="text-primary">Rescue it.</span>
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-muted sm:text-xl">
              ShareTable connects surplus meals with registered recipients nearby. Matching is distance, never a judgment of need.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 font-semibold text-accent-foreground shadow-[0_12px_28px_rgba(24,24,27,0.18)] transition-all hover:-translate-y-0.5 hover:bg-accent/90"
              >
                Donate food <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-4 font-semibold transition-colors hover:bg-secondary"
              >
                Find food <MapPin className="size-4 text-primary" />
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-muted">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> Pickup confirmed in person
              </span>
              <span className="inline-flex items-center gap-2">
                <Users className="size-4 text-primary" /> {radiusLabel} matching
              </span>
              <span className="inline-flex items-center gap-2">
                <Timer className="size-4 text-primary" /> {windowShort} listings
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[540px]">
            <div className="absolute -inset-4 rounded-[2.5rem] bg-primary/5 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-primary/10 bg-[#e7e7ec] p-4 shadow-[0_28px_80px_rgba(15,23,42,0.14)] sm:p-6">
              <div className="flex items-center justify-between rounded-2xl bg-card/80 px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-2.5">
                  <span className="size-2 rounded-full bg-accent" />
                  <span className="text-sm font-semibold">Live in your neighborhood</span>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">Live</span>
              </div>
              <div className="relative mt-4 aspect-[1.05] overflow-hidden rounded-[1.5rem] bg-primary p-6 text-primary-foreground sm:p-8">
                <div className="absolute -right-16 -top-16 size-56 rounded-full border-[22px] border-primary-foreground/10" />
                <div className="absolute -bottom-28 -left-16 size-72 rounded-full border-[30px] border-accent/30" />
                <div className="relative flex h-full flex-col justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary-foreground/70">Only picked-up meals</p>
                    <p className="mt-1 font-display text-4xl font-semibold leading-none tracking-tight sm:text-5xl">
                      count as
                      <br />
                      rescued.
                    </p>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-6xl font-semibold tracking-[-0.08em]">
                        {ready ? compactCount(mealsRescued) : "..."}
                      </p>
                      <p className="mt-1 text-sm text-primary-foreground/70">meals rescued</p>
                    </div>
                    <div className="flex size-20 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <HeartHandshake className="size-9" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-card p-4">
                  <p className="text-xs font-medium text-muted">Rescue window</p>
                  <p className="mt-1 font-display text-2xl font-semibold">{windowLabel}</p>
                </div>
                <div className="rounded-2xl bg-card p-4">
                  <p className="text-xs font-medium text-muted">Starting radius</p>
                  <p className="mt-1 font-display text-2xl font-semibold">{radiusLabel}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section id="impact" className="border-y border-border bg-card/60">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:grid-cols-3 sm:px-8 lg:px-12">
          {[
            [ready ? localeCount(mealsRescued) : "...", "meals rescued"],
            [ready ? localeCount(totalDonors) : "...", "donors"],
            [ready ? localeCount(totalNgos) : "...", "NGOs"],
          ].map(([value, label]) => (
            <div key={label} className="flex items-baseline gap-3 sm:block">
              <p className="font-display text-3xl font-semibold tracking-tight text-primary sm:text-4xl">{value}</p>
              <p className="text-sm text-muted sm:mt-1">{label}</p>
            </div>
          ))}
        </div>
        <p className="px-5 pb-8 text-center text-xs text-muted sm:px-8">
          Live totals from this platform. Only meals confirmed picked up count as rescued.
        </p>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-accent">How a rescue works</p>
            <h2 className="mt-4 max-w-md font-display text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl">
              From leftover to picked up, in three steps.
            </h2>
            <p className="mt-5 max-w-sm leading-7 text-muted">
              No predicted meal counts. Donors enter the surplus. Recipients nearby claim what they can collect.
            </p>
          </div>
          <div className="divide-y divide-border border-y border-border">
            {steps.map(({ number, icon: Icon, title, description }) => (
              <div key={number} className="grid gap-4 py-7 sm:grid-cols-[70px_42px_1fr] sm:items-start">
                <span className="font-mono text-sm font-semibold text-accent">{number}</span>
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-xl font-semibold">{title}</h3>
                  <p className="mt-2 max-w-md leading-7 text-muted">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-5 mb-8 overflow-hidden rounded-[2rem] bg-secondary sm:mx-8 lg:mx-auto lg:max-w-7xl">
        <div className="grid items-center gap-10 px-6 py-12 sm:px-10 lg:grid-cols-[1fr_auto] lg:px-16 lg:py-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-accent">For kitchens and messes</p>
            <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Post surplus before it is thrown away.
            </h2>
            <p className="mt-4 max-w-lg leading-7 text-muted">
              Nearby registered recipients are notified. You confirm pickup only when the collector is at the door.
            </p>
          </div>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 self-start rounded-full bg-primary px-5 py-3.5 font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary/90 lg:self-center"
          >
            Become a donor <MoveRight className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <Link to="/" className="font-display text-lg font-semibold text-foreground">
          ShareTable
        </Link>
        <p className="max-w-xl">
          Donors are responsible for ensuring donated food is safe, properly handled, and suitable for consumption.
          ShareTable only facilitates discovery, claiming, and pickup.
        </p>
      </footer>
    </main>
  );
}
