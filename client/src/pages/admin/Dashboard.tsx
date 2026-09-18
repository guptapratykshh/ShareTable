import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, PageLoading } from "../../components/PageChrome";
import { ThemedTileLayer } from "../../components/ThemedTileLayer";
import { MetricBoard } from "../../components/StatCard";
import { api } from "../../services/api";

type AdminStats = {
  mealsDonated: number;
  mealsRescued: number;
  activeMeals: number;
  totalDonations: number;
  activeDonations: number;
  totalDonors: number;
  totalRecipients: number;
  totalNgos: number;
  rescueRate: number;
  mealsRescuedToday: number;
  mealsRescuedThisWeek: number;
  mealsRescuedThisMonth: number;
  averagePickupMinutes: number;
  mostActiveDonors: { id: string; name: string; meals: number }[];
  mostActiveRecipients: { id: string; name: string; meals: number }[];
  mapDonations: { id: string; foodName: string; status: string; lat: number; lng: number; quantity: number }[];
  impact: { estimatedKgPrevented: number; estimatedValueInr: number; assumptions: { note: string } };
};

type Heatmap = {
  privacy: string;
  live: {
    id: string;
    liveState: "ACTIVE" | "URGENT" | "RESCUED" | "EXPIRED";
    liveStateLabel: string;
    meals: number;
    quantity: number;
    lat: number;
    lng: number;
  }[];
  cells: {
    areaId: string;
    placeName: string;
    lat: number;
    lng: number;
    donations: number;
    activeDonations: number;
    urgentDonations: number;
    mealsAvailable: number;
    mealsRescued: number;
    expiredDonations: number;
    averageRescueMinutes: number;
  }[];
};

type Activity = {
  totalDonations: number;
  donationsRequiringEscalation: number;
  level1Rescues: number;
  level2Rescues: number;
  level3Rescues: number;
  rescuedAfterEscalation: number;
  expiredAfterEscalation: number;
  escalationRescueSuccess: string;
};

type ReliabilityRow = {
  id: string;
  name: string;
  score: number | null;
  sampleSize: number;
  successfulRescues: number;
  label: string;
};

const STATE_COLOR: Record<string, string> = {
  URGENT: "#9b2226",
  ACTIVE: "#b5651d",
  RESCUED: "#2d6a4f",
  EXPIRED: "#7a7268",
};

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [reliability, setReliability] = useState<ReliabilityRow[]>([]);
  const [range, setRange] = useState("today");
  const [error, setError] = useState("");

  async function load(nextRange = range) {
    const [dash, map, act, rel] = await Promise.all([
      api<AdminStats>("/api/dashboard/admin"),
      api<Heatmap>(`/api/admin/heatmap?range=${nextRange}`),
      api<Activity>("/api/admin/rescue-activity"),
      api<{ recipients: ReliabilityRow[] }>("/api/admin/reliability"),
    ]);
    setStats(dash);
    setHeatmap(map);
    setActivity(act);
    setReliability(rel.recipients);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-alert">{error}</p>;
  if (!stats) return <PageLoading label="Loading impact…" />;

  return (
    <div className="space-y-8 pb-6">
      <PageHeader
        eyebrow="ShareTable impact"
        title="ShareTable impact"
        subtitle="Only picked-up meals count as rescued. Unclaimed expired meals do not."
      />

      <div className="overflow-hidden rounded-[1.25rem] border border-border bg-card">
        <p className="border-b border-border px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
          Platform snapshot
        </p>
        <div className="grid gap-px bg-border sm:grid-cols-3">
          <div className="bg-card px-5 py-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Donated</p>
            <p className="display mt-2 text-[2.35rem] font-semibold leading-none tracking-[-0.05em]">{stats.mealsDonated}</p>
          </div>
          <div className="bg-card px-5 py-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Rescued</p>
            <p className="display mt-2 text-[2.35rem] font-semibold leading-none tracking-[-0.05em]">{stats.mealsRescued}</p>
          </div>
          <div className="bg-card px-5 py-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Rescue rate</p>
            <p className="display mt-2 text-[2.35rem] font-semibold leading-none tracking-[-0.05em]">{stats.rescueRate}%</p>
          </div>
        </div>
        <p className="border-t border-border px-5 py-3 text-sm text-muted">
          {stats.activeMeals} meals still available · 1-hour rescue window · radius starts at 2.5 km and may expand
        </p>
      </div>

      <MetricBoard
        title="Rescue activity"
        items={[
          { label: "Total donations", value: stats.totalDonations },
          { label: "Active donations", value: stats.activeDonations },
          { label: "Donors", value: stats.totalDonors },
          { label: "Registered NGOs", value: stats.totalNgos, hint: `${stats.totalRecipients} recipients total` },
          { label: "Rescued today", value: stats.mealsRescuedToday },
          { label: "Rescued this week", value: stats.mealsRescuedThisWeek },
          { label: "Rescued this month", value: stats.mealsRescuedThisMonth },
          { label: "Avg pickup time", value: `${stats.averagePickupMinutes} min` },
        ]}
      />

      {activity && (
        <MetricBoard
          title="Escalation"
          items={[
            { label: "Level 1 listings", value: activity.level1Rescues },
            { label: "Level 2 listings", value: activity.level2Rescues },
            { label: "Level 3 listings", value: activity.level3Rescues },
            {
              label: "Rescued after expansion",
              value: activity.rescuedAfterEscalation,
              hint: `${activity.escalationRescueSuccess} · ${activity.expiredAfterEscalation} expired after expansion`,
            },
          ]}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.5rem] border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold">Most active donors</h2>
          <div className="h-52">
            <ResponsiveContainer>
              <BarChart data={stats.mostActiveDonors} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="meals" fill="var(--accent)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="overflow-hidden rounded-[1.5rem] border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4 pb-2">
            <h2 className="font-semibold">Live rescue map</h2>
            <select
              className="rounded-full border border-border bg-card px-2 py-1 text-sm"
              value={range}
              onChange={(e) => {
                const next = e.target.value;
                setRange(next);
                load(next).catch((err) => setError(err.message));
              }}
            >
              <option value="today">Today</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
            </select>
          </div>
          <div className="h-64">
            <MapContainer center={[12.9352, 77.6245]} zoom={13} className="h-full w-full">
              <ThemedTileLayer />
              {(heatmap?.live ?? []).map((d) => (
                <CircleMarker
                  key={d.id}
                  center={[d.lat, d.lng]}
                  radius={10}
                  pathOptions={{ color: STATE_COLOR[d.liveState], fillColor: STATE_COLOR[d.liveState], fillOpacity: 0.85 }}
                >
                  <Popup>
                    <p className="font-semibold">{d.liveStateLabel}</p>
                    <p>
                      {d.meals} meals available of {d.quantity}
                    </p>
                    <p className="text-xs">Approximate area only (~200 m grid).</p>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
          <p className="px-4 py-2 text-xs text-muted">
            {heatmap?.privacy ?? "Markers are snapped to a ~200 m grid. Exact GPS is not shown."}
          </p>
        </div>
      </div>

      {heatmap && heatmap.cells.length > 0 && (
        <section className="rounded-[1.5rem] border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold">Aggregated rescue cells</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th className="px-3 py-2">Area</th>
                  <th className="px-3 py-2">Donations</th>
                  <th className="px-3 py-2">Available</th>
                  <th className="px-3 py-2">Rescued</th>
                  <th className="px-3 py-2">Expired</th>
                  <th className="px-3 py-2">Avg rescue</th>
                </tr>
              </thead>
              <tbody>
                {heatmap.cells.map((c) => (
                  <tr key={c.areaId} className="border-t border-border">
                    <td className="px-3 py-2">{c.placeName}</td>
                    <td className="px-3 py-2">{c.donations}</td>
                    <td className="px-3 py-2">{c.mealsAvailable}</td>
                    <td className="px-3 py-2">{c.mealsRescued}</td>
                    <td className="px-3 py-2">{c.expiredDonations}</td>
                    <td className="px-3 py-2">{c.averageRescueMinutes} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-xs text-muted">
        Estimated food waste prevented: {stats.impact.estimatedKgPrevented} kg · ₹{stats.impact.estimatedValueInr} saved.{" "}
        {stats.impact.assumptions.note}
      </p>

      <section>
        <h2 className="mb-3 font-semibold">Operational reliability</h2>
        <p className="mb-3 text-sm text-muted">Computed from claim outcomes. Not a ranking and not stored on user records.</p>
        <div className="overflow-x-auto rounded-[1.5rem] border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="px-3 py-2">Organization</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Sample</th>
                <th className="px-3 py-2">Meals rescued</th>
              </tr>
            </thead>
            <tbody>
              {reliability.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">{r.score == null ? "-" : r.score}</td>
                  <td className="px-3 py-2">{r.sampleSize}</td>
                  <td className="px-3 py-2">{r.successfulRescues}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
