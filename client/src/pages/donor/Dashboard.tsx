import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ButtonLink, PageHeader, PageLoading } from "../../components/PageChrome";
import { StatCard } from "../../components/StatCard";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

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

export function DonorDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DonorStats | null>(null);
  const [patterns, setPatterns] = useState<Patterns | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<DonorStats>("/api/dashboard/donor"), api<Patterns>("/api/donor/patterns")])
      .then(([dash, pats]) => {
        setStats(dash);
        setPatterns(pats);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-alert">{error}</p>;
  if (!stats) return <PageLoading label="Loading dashboard…" />;

  const org = user?.organizationName || user?.name || "there";
  const shortOrg = org.split(" ")[0];
  const rescuedPct = Math.max(0, Math.min(100, stats.rescueRate));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Donor workspace"
        title="Your food impact, at a glance."
        subtitle="Track what you share, what gets claimed, and where your rescue rate is improving."
        actions={<ButtonLink to="/donor/donate">Donate surplus →</ButtonLink>}
      />

      <section className="grid items-center gap-8 rounded-[18px] border border-accent/35 bg-[color-mix(in_srgb,var(--accent)_8%,var(--card))] px-6 py-5 lg:grid-cols-[1fr_minmax(270px,0.65fr)]">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-[11px] bg-accent font-black text-accent-foreground">↗</span>
          <div>
            <b className="text-sm">Great work, {shortOrg}.</b>
            <p className="mt-1 text-xs text-muted">You've rescued {stats.mealsRescued} meals so far.</p>
          </div>
        </div>
        <div>
          <div className="mb-2 flex justify-between text-[11px] font-bold text-muted">
            <span>Meals rescued</span>
            <b className="text-foreground">{stats.mealsRescued}</b>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${rescuedPct}%` }} />
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Meals donated" value={stats.mealsDonated} hint="Total posted" />
        <StatCard label="Meals claimed" value={stats.mealsClaimed ?? 0} hint="Awaiting pickup" />
        <StatCard label="Meals rescued" value={stats.mealsRescued} hint="Confirmed pickup" />
        <StatCard label="Rescue rate" value={`${stats.rescueRate}%`} hint="Counted only after pickup" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
        <article className="rounded-[20px] border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Activity</p>
              <h2 className="display mt-1 text-[25px]">Meals shared</h2>
            </div>
          </div>
          <div className="mt-6 h-[190px]">
            <ResponsiveContainer>
              <BarChart data={stats.mealsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <Tooltip />
                <Bar dataKey="donated" fill="var(--secondary)" name="Donated" radius={[6, 6, 0, 0]} />
                <Bar dataKey="rescued" fill="var(--accent)" name="Rescued" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-[20px] border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Outcome</p>
              <h2 className="display mt-1 text-[25px]">Rescue rate</h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8 py-8">
            <div
              className="relative grid size-[148px] place-content-center rounded-full text-center"
              style={{
                background: `conic-gradient(var(--accent) 0 ${rescuedPct}%, var(--secondary) ${rescuedPct}% 100%)`,
              }}
            >
              <span className="absolute inset-[20px] rounded-full bg-card" />
              <strong className="relative display text-[28px] leading-none">
                {stats.rescueRate}
                <small className="text-sm">%</small>
              </strong>
              <span className="relative text-[10px] text-muted">rescued</span>
            </div>
            <div className="grid min-w-[100px] gap-3.5 text-[11px] text-muted">
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                <i className="size-2 rounded-full bg-accent" />
                <span>Rescued</span>
                <b className="text-foreground">{stats.mealsRescued}</b>
              </div>
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                <i className="size-2 rounded-full bg-secondary" />
                <span>Unrescued</span>
                <b className="text-foreground">{stats.mealsUnrescued ?? 0}</b>
              </div>
            </div>
          </div>
          <p className="text-[11px] leading-5 text-muted">
            Every confirmed pickup counts. {stats.activeDonations} listings currently active · avg pickup {stats.averagePickupMinutes ?? 0} min.
          </p>
        </article>
      </div>

      <section className="flex items-center justify-between gap-8 rounded-[20px] bg-mint px-7 py-6 text-[#171a17]">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#665849]">
            One useful signal{patterns?.demoDataLabel ? ` · ${patterns.demoDataLabel}` : ""}
          </p>
          {!patterns?.ready ? (
            <>
              <h2 className="display mt-1 max-w-[580px] text-[28px] text-[#171a17]">Patterns need more history.</h2>
              <p className="mt-2.5 max-w-[620px] text-[13px] leading-6 text-[#665849]">
                A pattern needs at least {patterns?.minDonations ?? 5} donations. {patterns?.observed ?? 0} recorded so far.
                Observations come from your recorded donation history, not predictions of future demand.
              </p>
            </>
          ) : patterns.insights[0] ? (
            <>
              <h2 className="display mt-1 max-w-[580px] text-[28px] text-[#171a17]">{patterns.insights[0].title}</h2>
              <p className="mt-2.5 max-w-[620px] text-[13px] leading-6 text-[#665849]">
                {patterns.insights[0].explanation || patterns.insights[0].body}
              </p>
            </>
          ) : (
            <>
              <h2 className="display mt-1 max-w-[580px] text-[28px] text-[#171a17]">No recurring surplus pattern yet.</h2>
              <p className="mt-2.5 max-w-[620px] text-[13px] leading-6 text-[#665849]">
                Patterns are learned from your recorded donation history. They are observations, not predictions.
              </p>
            </>
          )}
        </div>
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#171a17] text-xl text-mint">↗</span>
      </section>

      <p className="text-xs text-muted">
        Estimated waste prevented: {stats.impact.estimatedKgPrevented} kg · value saved ₹{stats.impact.estimatedValueInr}.{" "}
        {stats.impact.assumptions.note}
        {stats.mostCommonCategory ? ` Most common category: ${stats.mostCommonCategory}.` : ""}
      </p>
    </div>
  );
}
