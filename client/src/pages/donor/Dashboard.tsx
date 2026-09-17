import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DonationCard } from "../../components/DonationCard";
import { StatCard } from "../../components/StatCard";
import { api } from "../../services/api";
import type { Donation } from "../../types";

type DonorStats = {
  mealsDonated: number;
  mealsClaimed: number;
  mealsRescued: number;
  mealsUnrescued: number;
  activeDonations: number;
  completedDonations: number;
  expiredDonations: number;
  totalDonations: number;
  rescueRate: number;
  averagePickupMinutes: number;
  averageMinutesToFirstClaim: number;
  mostCommonCategory: string | null;
  demoDataLabel?: string;
  statusDistribution: Record<string, number>;
  mealsOverTime: { date: string; donated: number; rescued: number }[];
  rescueRateByWeek: { week: string; donated: number; rescued: number; rescueRate: number }[];
  impact: { estimatedKgPrevented: number; estimatedValueInr: number; assumptions: { note: string } };
  recentDonations: Donation[];
};

type PatternInsight = {
  title: string;
  body: string;
  explanation?: string;
  facts: Record<string, string | number>;
};

type Patterns = {
  ready: boolean;
  observed: number;
  minDonations: number;
  demoDataLabel?: string;
  insights: PatternInsight[];
  byDay: { day: string; meals: number; count: number; average: number }[];
};

const COLORS = ["oklch(0.22 0 0)", "oklch(0.38 0 0)", "oklch(0.52 0 0)", "oklch(0.68 0 0)", "#9b2226", "oklch(0.18 0 0)"];

export function DonorDashboard() {
  const [stats, setStats] = useState<DonorStats | null>(null);
  const [patterns, setPatterns] = useState<Patterns | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<DonorStats>("/api/dashboard/donor"),
      api<Patterns>("/api/donor/patterns"),
    ])
      .then(([dash, pats]) => {
        setStats(dash);
        setPatterns(pats);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-alert">{error}</p>;
  if (!stats) return <p className="text-muted">Loading dashboard…</p>;

  const pie = Object.entries(stats.statusDistribution)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl font-semibold tracking-tight">Donor dashboard</h1>
          <p className="mt-1 text-muted">Track surplus you posted and meals that were actually picked up.</p>
        </div>
        <Link
          to="/donor/donate"
          className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary/90"
        >
          Donate surplus food
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Meals donated" value={stats.mealsDonated} />
        <StatCard label="Meals claimed" value={stats.mealsClaimed ?? 0} />
        <StatCard label="Meals rescued" value={stats.mealsRescued} hint="Counted only after pickup" />
        <StatCard label="Rescue rate" value={`${stats.rescueRate}%`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Unrescued meals" value={stats.mealsUnrescued ?? 0} />
        <StatCard label="Currently active" value={stats.activeDonations} />
        <StatCard
          label="Avg time to first claim"
          value={`${stats.averageMinutesToFirstClaim ?? 0} min`}
        />
        <StatCard
          label="Avg pickup time"
          value={`${stats.averagePickupMinutes ?? 0} min`}
          hint="Picked up minus claimed, pickup only"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.5rem] border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold">Meals over the last 7 days</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={stats.mealsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.84 0 0)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="donated" fill="oklch(0.22 0 0)" name="Donated" />
                <Bar dataKey="rescued" fill="oklch(0.45 0 0)" name="Rescued" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold">Donation status</h2>
          <div className="h-56">
            {pie.length === 0 ? (
              <p className="text-sm text-muted">No donations yet.</p>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                    {pie.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {stats.rescueRateByWeek && (
        <div className="rounded-[1.5rem] border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold">Rescue rate by week</h2>
          <div className="h-52">
            <ResponsiveContainer>
              <BarChart data={stats.rescueRateByWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.84 0 0)" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="rescueRate" fill="oklch(0.22 0 0)" name="Rescue rate %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <p className="text-xs text-muted">
        Estimated waste prevented: {stats.impact.estimatedKgPrevented} kg · value saved ₹{stats.impact.estimatedValueInr}.{" "}
        {stats.impact.assumptions.note}
        {stats.mostCommonCategory ? ` Most common category: ${stats.mostCommonCategory}.` : ""}
      </p>

      <section className="rounded-[1.5rem] border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Intelligence</h2>
          {patterns?.demoDataLabel && (
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted">
              {patterns.demoDataLabel}
            </span>
          )}
        </div>
        <p className="text-sm text-muted">
          Patterns are learned from your recorded donation history. They are observations, not predictions of future demand.
        </p>
        {!patterns?.ready && (
          <p className="mt-3 text-sm text-muted">
            A pattern needs at least {patterns?.minDonations ?? 5} donations. {patterns?.observed ?? 0} recorded so far.
          </p>
        )}
        {patterns?.insights.map((insight) => (
          <div key={insight.title} className="mt-4 rounded-xl bg-primary/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">{insight.title}</p>
            <p className="mt-2 text-sm text-foreground">{insight.explanation || insight.body}</p>
          </div>
        ))}
        {patterns?.ready && patterns.insights.length === 0 && (
          <p className="mt-3 text-sm text-muted">No recurring surplus pattern is strong enough to highlight yet.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Recent donations</h2>
        {stats.recentDonations.length === 0 ? (
          <p className="text-sm text-muted">No donations yet. Post surplus food to notify recipients within 2.5 km.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {stats.recentDonations.map((d) => (
              <DonationCard key={d.id} donation={d} actionLabel="View details" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
