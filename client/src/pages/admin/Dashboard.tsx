import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
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
import { StatCard } from "../../components/StatCard";
import { api } from "../../services/api";
import type { User } from "../../types";

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
  const [users, setUsers] = useState<User[]>([]);
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [reliability, setReliability] = useState<ReliabilityRow[]>([]);
  const [range, setRange] = useState("today");
  const [error, setError] = useState("");

  async function load(nextRange = range) {
    const [dash, list, map, act, rel] = await Promise.all([
      api<AdminStats>("/api/dashboard/admin"),
      api<{ users: User[] }>("/api/admin/users"),
      api<Heatmap>(`/api/admin/heatmap?range=${nextRange}`),
      api<Activity>("/api/admin/rescue-activity"),
      api<{ recipients: ReliabilityRow[] }>("/api/admin/reliability"),
    ]);
    setStats(dash);
    setUsers(list.users);
    setHeatmap(map);
    setActivity(act);
    setReliability(rel.recipients);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function patchUser(id: string, body: { isVerified?: boolean; isFlagged?: boolean }) {
    await api(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    load().catch(() => undefined);
  }

  if (error) return <p className="text-alert">{error}</p>;
  if (!stats) return <p className="text-muted">Loading impact…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-4xl font-semibold tracking-tight">ShareTable impact</h1>
        <p className="mt-1 text-muted">Only picked-up meals count as rescued. Unclaimed expired meals do not.</p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">Platform snapshot</p>
        <div className="mt-4 grid gap-6 sm:grid-cols-3">
          <div>
            <p className="display text-5xl font-semibold tracking-tight">{stats.mealsDonated}</p>
            <p className="text-sm text-muted">Donated</p>
          </div>
          <div>
            <p className="display text-5xl font-semibold tracking-tight">{stats.mealsRescued}</p>
            <p className="text-sm text-muted">Rescued</p>
          </div>
          <div>
            <p className="display text-5xl font-semibold tracking-tight">{stats.rescueRate}%</p>
            <p className="text-sm text-muted">Rescue rate</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted">
          {stats.activeMeals} meals still available · 1-hour rescue window · radius starts at 2.5 km and may expand
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total donations" value={stats.totalDonations} />
        <StatCard label="Active donations" value={stats.activeDonations} />
        <StatCard label="Donors" value={stats.totalDonors} />
        <StatCard label="Registered NGOs" value={stats.totalNgos} hint={`${stats.totalRecipients} recipients total`} />
        <StatCard label="Rescued today" value={stats.mealsRescuedToday} />
        <StatCard label="Rescued this week" value={stats.mealsRescuedThisWeek} />
        <StatCard label="Rescued this month" value={stats.mealsRescuedThisMonth} />
        <StatCard label="Avg pickup time" value={`${stats.averagePickupMinutes} min`} />
      </div>

      {activity && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Level 1 listings" value={activity.level1Rescues} />
          <StatCard label="Level 2 listings" value={activity.level2Rescues} />
          <StatCard label="Level 3 listings" value={activity.level3Rescues} />
          <StatCard
            label="Rescued after escalation"
            value={activity.rescuedAfterEscalation}
            hint={`${activity.escalationRescueSuccess} · ${activity.expiredAfterEscalation} expired after expansion`}
          />
        </div>
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
                <Bar dataKey="meals" fill="oklch(0.22 0 0)" />
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
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
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
                    <td className="px-3 py-2 font-mono text-xs">{c.areaId}</td>
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

      <section>
        <h2 className="mb-3 font-semibold">Users</h2>
        <div className="overflow-x-auto rounded-[1.5rem] border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Verified</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users
                .filter((u) => u.role !== "ADMIN")
                .map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-3 py-2">{u.organizationName || u.name}</td>
                    <td className="px-3 py-2">{u.role}</td>
                    <td className="px-3 py-2">{u.donorType || u.recipientType}</td>
                    <td className="px-3 py-2">{u.isVerified ? "Yes" : "No"}</td>
                    <td className="space-x-2 px-3 py-2">
                      {u.role === "RECIPIENT" && u.recipientType === "NGO" && (
                        <button className="text-primary" onClick={() => patchUser(u.id, { isVerified: !u.isVerified })}>
                          {u.isVerified ? "Unverify" : "Verify NGO"}
                        </button>
                      )}
                      <button className="text-alert" onClick={() => patchUser(u.id, { isFlagged: !u.isFlagged })}>
                        {u.isFlagged ? "Clear flag" : "Flag"}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
