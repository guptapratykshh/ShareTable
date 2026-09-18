import { useEffect, useMemo, useState } from "react";
import { DonationCard } from "../../components/DonationCard";
import { ButtonLink, EmptyState, FilterPills, PageHeader, PageLoading, SectionToolbar } from "../../components/PageChrome";
import { RescueMap, type RescueLiveMarker } from "../../components/RescueMap";
import { MetricStrip } from "../../components/StatCard";
import { api } from "../../services/api";
import type { Claim, Donation } from "../../types";

type Reliability = {
  score: number | null;
  sampleSize: number;
  successfulPickupRate: number;
  onTimeRate: number;
  cancellationRate: number;
  noShowRate: number;
  successfulRescues: number;
  label: string;
};

type Heatmap = {
  center: { lat: number; lng: number };
  privacy: string;
  live: RescueLiveMarker[];
  surplusAreas: { name: string; meals: number }[];
};

type NearbyFilter = "all" | "urgent" | "expanded" | "normal";

function groupDonations(donations: Donation[]) {
  const urgent = donations.filter((d) => d.urgencyBand === "CRITICAL");
  const expanded = donations.filter((d) => d.urgencyBand === "EXPANDED");
  const normal = donations.filter((d) => d.urgencyBand !== "CRITICAL" && d.urgencyBand !== "EXPANDED");
  return { urgent, expanded, normal };
}

export function RecipientDashboard() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [stats, setStats] = useState<{
    mealsPickedUp: number;
    activeClaims: number;
    reliability?: Reliability;
    heatmap?: Heatmap;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NearbyFilter>("all");

  useEffect(() => {
    Promise.all([
      api<{ donations: Donation[] }>("/api/donations/nearby"),
      api<{ mealsPickedUp: number; activeClaims: number; reliability: Reliability; recentClaims: Claim[]; heatmap: Heatmap }>(
        "/api/dashboard/recipient",
      ),
    ])
      .then(([nearby, dash]) => {
        setDonations(nearby.donations);
        setStats(dash);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const groups = groupDonations(donations);
  const heatmap = stats?.heatmap;
  const maxSurplus = Math.max(1, ...(heatmap?.surplusAreas.map((a) => a.meals) ?? [1]));
  const visible = useMemo(() => {
    if (filter === "urgent") return groups.urgent;
    if (filter === "expanded") return groups.expanded;
    if (filter === "normal") return groups.normal;
    return donations;
  }, [donations, filter, groups.expanded, groups.normal, groups.urgent]);

  if (loading) return <PageLoading label="Loading nearby food…" />;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Recipient workspace"
        title="Nearby food"
        subtitle="Active donations whose current rescue radius covers your registered location. Listings expiring soon appear first."
        actions={
          <ButtonLink to="/recipient/claims">
            My claims <span aria-hidden>→</span>
          </ButtonLink>
        }
      />
      {stats && (
        <MetricStrip
          items={[
            { label: "Meals picked up", value: stats.mealsPickedUp },
            { label: "Pickups pending", value: stats.activeClaims },
            {
              label: "Reliability",
              value: stats.reliability?.score == null ? "—" : stats.reliability.score,
              hint: stats.reliability?.sampleSize ? `${stats.reliability.sampleSize} claims` : "Not enough history yet",
            },
          ]}
        />
      )}
      {heatmap && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-[20px] border border-border bg-card">
            <div className="p-4 pb-2">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Live map</p>
              <h2 className="display mt-1 text-[25px]">Rescue heatmap</h2>
            </div>
            <div className="h-64">
              <RescueMap center={heatmap.center} markers={heatmap.live} />
            </div>
            <div className="flex flex-wrap gap-4 px-4 pt-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rescued" /> Successfully rescued
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-warn" /> Active donation
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-alert" /> Urgent / approaching expiration
              </span>
            </div>
            <p className="px-4 py-3 text-xs text-muted">{heatmap.privacy}</p>
          </div>
          <section className="rounded-[20px] border border-border bg-card p-6">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Neighborhood</p>
            <h2 className="display mt-1 text-[25px]">High surplus areas</h2>
            <ul className="mt-6 space-y-3">
              {heatmap.surplusAreas.map((area) => (
                <li key={area.name} className="flex items-center gap-3">
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(8, (area.meals / maxSurplus) * 100)}%` }}
                    />
                  </div>
                  <span className="w-40 shrink-0 text-sm">
                    {area.name}
                    <span className="ml-1 text-muted">{area.meals}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
      {error && <p className="text-alert">{error}</p>}

      <div id="listings" className="space-y-4">
        <SectionToolbar label="Available now" meta={`${visible.length} listing${visible.length === 1 ? "" : "s"}`}>
          <FilterPills
            value={filter}
            onChange={setFilter}
            options={[
              { id: "all", label: "All" },
              { id: "urgent", label: "Urgent" },
              { id: "expanded", label: "Expanded" },
              { id: "normal", label: "Normal" },
            ]}
          />
        </SectionToolbar>
        {visible.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((d) => (
              <DonationCard key={d.id} donation={d} />
            ))}
          </div>
        ) : (
          !error && (
            <EmptyState
              title="Nothing nearby right now"
              body="No active donations in range. New posts appear here and in notifications."
            />
          )
        )}
      </div>
    </div>
  );
}
