import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
import { MetricBoard, MetricStrip } from "../../components/StatCard";
import { ToneBadge } from "../../components/StatusBadge";
import { api } from "../../services/api";
import type { Claim, Donation, User } from "../../types";
import { formatDateTime } from "../../utils/format";
import { AdminPanel } from "./AdminChrome";

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

function eventTone(status: string): "good" | "warn" | "bad" | "neutral" {
  if (status === "PICKED_UP") return "good";
  if (status === "CANCELLED" || status === "NO_SHOW") return "bad";
  if (status === "CLAIMED" || status === "PICKUP_PENDING") return "neutral";
  return "neutral";
}

function eventLabel(status: string) {
  if (status === "PICKED_UP") return "Pickup completed";
  if (status === "CANCELLED") return "Claim cancelled";
  if (status === "NO_SHOW") return "No show";
  return "Claim created";
}

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [reliability, setReliability] = useState<ReliabilityRow[]>([]);
  const [expiredCount, setExpiredCount] = useState(0);
  const [pendingVerification, setPendingVerification] = useState(0);
  const [recentClaims, setRecentClaims] = useState<Claim[]>([]);
  const [range, setRange] = useState("today");
  const [error, setError] = useState("");

  async function load(nextRange = range) {
    const [dash, map, act, rel, listings, users, claims] = await Promise.all([
      api<AdminStats>("/api/dashboard/admin"),
      api<Heatmap>(`/api/admin/heatmap?range=${nextRange}`),
      api<Activity>("/api/admin/rescue-activity"),
      api<{ recipients: ReliabilityRow[] }>("/api/admin/reliability"),
      api<{ donations: Donation[] }>("/api/admin/donations"),
      api<{ users: User[] }>("/api/admin/users"),
      api<{ claims: Claim[] }>("/api/admin/claims"),
    ]);
    setStats(dash);
    setHeatmap(map);
    setActivity(act);
    setReliability(rel.recipients);
    setExpiredCount(listings.donations.filter((d) => d.status === "EXPIRED").length);
    setPendingVerification(users.users.filter((u) => !u.isVerified).length);
    setRecentClaims(claims.claims.slice(0, 6));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-alert">{error}</p>;
  if (!stats) return <PageLoading label="Loading impact…" />;

  const strongest = heatmap?.cells.slice().sort((a, b) => b.mealsRescued - a.mealsRescued)[0];
  const strongestName = stats.mostActiveDonors[0]?.name || strongest?.placeName;
  const weekBars = (heatmap?.cells ?? []).slice(0, 7).map((c) => c.mealsRescued);
  const weekBarValues = weekBars.length ? weekBars : [18, 32, 28, 48, 40, 56, 44];
  const maxWeekBar = Math.max(1, ...weekBarValues);
  const openQueue = expiredCount + pendingVerification;
  const monthHint =
    stats.mealsRescuedThisMonth > 0 ? `${stats.mealsRescuedThisMonth} rescued this month` : "Confirmed pickups only";

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        eyebrow="Admin overview"
        title="ShareTable impact"
        subtitle="A focused view of what is moving, what needs attention, and where rescue is working."
      />

      <MetricStrip
        variant="kpi"
        items={[
          { label: "Meals rescued", value: stats.mealsRescued, hint: monthHint },
          { label: "Rescue rate", value: `${stats.rescueRate}%`, hint: `Across ${stats.totalDonations} listings` },
          {
            label: "Active listings",
            value: stats.activeDonations,
            hint: stats.activeDonations === 0 ? "All clear right now" : `${stats.activeMeals} meals still available`,
          },
          { label: "Pickup time", value: `${stats.averagePickupMinutes}m`, hint: "Average handoff" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminPanel>
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Attention queue</p>
              <h2 className="display mt-1 text-[27px] tracking-[-0.04em]">Needs a decision</h2>
            </div>
            <ToneBadge tone={openQueue > 0 ? "warn" : "good"}>{`${openQueue} open`}</ToneBadge>
          </div>
          <div className="flex items-center gap-3.5 border-t border-border py-4">
            <div className="flex-1">
              <b>Unclaimed listings</b>
              <p className="mt-1 text-xs text-muted">Expired before a collector arrived</p>
            </div>
            <strong className="display text-[25px]">{expiredCount}</strong>
            <Link to="/admin/listings" className="text-xs font-extrabold text-accent">
              Review →
            </Link>
          </div>
          <div className="flex items-center gap-3.5 border-t border-border py-4">
            <div className="flex-1">
              <b>Pending verification</b>
              <p className="mt-1 text-xs text-muted">New kitchens and collectors</p>
            </div>
            <strong className="display text-[25px]">{pendingVerification}</strong>
            <Link to="/admin/kitchens" className="text-xs font-extrabold text-accent">
              Review →
            </Link>
          </div>
        </AdminPanel>

        <AdminPanel accent className="overflow-hidden">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">This week</p>
          <h2 className="display mt-2 text-[35px] tracking-[-0.04em]">{stats.mealsRescuedThisWeek} meals rescued</h2>
          <p className="mt-2.5 max-w-xs text-[13px] leading-6 text-muted">
            {strongestName
              ? `Rescue activity is strongest around ${strongestName}. Keep pickup windows visible and short.`
              : "Keep pickup windows visible and short so meals move before they expire."}
          </p>
          <div className="mt-6 flex h-[74px] items-end gap-1.5 overflow-hidden">
            {weekBarValues.map((value, index) => (
              <span
                key={index}
                className="min-h-2 flex-1 rounded-t-[5px] bg-accent/85"
                style={{ height: `${Math.round(Math.max(10, (value / maxWeekBar) * 74))}px` }}
              />
            ))}
          </div>
        </AdminPanel>
      </div>

      <AdminPanel>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Recent activity</p>
            <h2 className="display mt-1 text-[27px] tracking-[-0.04em]">Latest rescue events</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.08em] text-muted">
              <tr>
                <th className="pb-3 font-semibold">Event</th>
                <th className="pb-3 font-semibold">Listing</th>
                <th className="pb-3 font-semibold">When</th>
                <th className="pb-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentClaims.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="py-4">{eventLabel(c.status)}</td>
                  <td className="py-4">{c.donation?.foodName ?? "Listing"}</td>
                  <td className="py-4">{formatDateTime(c.pickedUpAt ?? c.claimedAt)}</td>
                  <td className="py-4">
                    <ToneBadge tone={eventTone(c.status)}>{c.status === "PICKED_UP" ? "Rescued" : c.status.replaceAll("_", " ")}</ToneBadge>
                  </td>
                </tr>
              ))}
              {recentClaims.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-sm text-muted">
                    No rescue events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>

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
        <AdminPanel>
          <h2 className="mb-3 display text-[25px]">Most active donors</h2>
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
        </AdminPanel>
        <AdminPanel className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 p-6 pb-2">
            <h2 className="display text-[25px]">Live rescue map</h2>
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
            <MapContainer center={[12.9352, 77.6245]} zoom={13} className="h-full w-full rounded-none">
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
          <p className="px-6 py-3 text-xs text-muted">
            {heatmap?.privacy ?? "Markers are snapped to a ~200 m grid. Exact GPS is not shown."}
          </p>
        </AdminPanel>
      </div>

      {heatmap && heatmap.cells.length > 0 && (
        <AdminPanel>
          <h2 className="mb-3 display text-[25px]">Aggregated rescue cells</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-[11px] uppercase tracking-[0.08em] text-muted">
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
        </AdminPanel>
      )}

      <p className="text-xs text-muted">
        Estimated food waste prevented: {stats.impact.estimatedKgPrevented} kg · ₹{stats.impact.estimatedValueInr} saved.{" "}
        {stats.impact.assumptions.note}
      </p>

      <AdminPanel>
        <h2 className="mb-1 display text-[25px]">Operational reliability</h2>
        <p className="mb-4 text-sm text-muted">Computed from claim outcomes. Not a ranking and not stored on user records.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-[11px] uppercase tracking-[0.08em] text-muted">
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
      </AdminPanel>
    </div>
  );
}
