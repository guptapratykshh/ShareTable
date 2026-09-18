import { Donation } from "../models/Donation.js";
import { Claim } from "../models/Claim.js";
import { User } from "../models/User.js";
import { maxRescueRadiusKm } from "../config.js";
import { haversineKm } from "../utils.js";
import { findNearbyDonations } from "./geo.js";
import { computeUrgency } from "./urgency.js";

const CELL = 0.002; // ~200m at Bengaluru latitude

function snap(n: number) {
  return Number((Math.round(n / CELL) * CELL).toFixed(4));
}

function cellId(lat: number, lng: number) {
  return `${snap(lat)},${snap(lng)}`;
}

/** Demo Bengaluru zones. Donations map to the nearest centroid within 2 km. */
export const SURPLUS_AREAS = [
  { name: "Campus Cafeteria", lat: 12.9352, lng: 77.6245 },
  { name: "Koramangala", lat: 12.9352, lng: 77.646 },
  { name: "HSR", lat: 12.911, lng: 77.647 },
  { name: "Indiranagar", lat: 12.978, lng: 77.641 },
] as const;

export function nearestSurplusArea(lat: number, lng: number) {
  let best: (typeof SURPLUS_AREAS)[number] | undefined;
  let bestKm = 2;
  for (const area of SURPLUS_AREAS) {
    const km = haversineKm(lng, lat, area.lng, area.lat);
    if (km <= bestKm) {
      best = area;
      bestKm = km;
    }
  }
  return best;
}

function rangeStart(range: string) {
  const now = Date.now();
  if (range === "30d") return new Date(now - 30 * 86400000);
  if (range === "7d") return new Date(now - 7 * 86400000);
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const PHOTON = "https://photon.komoot.io";
const PHOTON_UA = "ShareTable/1.0 (https://github.com/the-ivii/ShareTable)";

async function reverseAreaName(lat: number, lng: number) {
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng) });
    const res = await fetch(`${PHOTON}/reverse?${params}`, {
      headers: { Accept: "application/json", "User-Agent": PHOTON_UA },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      features?: { properties?: Record<string, unknown> }[];
    };
    const props = data.features?.[0]?.properties ?? {};
    for (const key of ["city", "district", "county", "town", "state"] as const) {
      const value = props[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function adminHeatmap(range = "today") {
  const from = rangeStart(range);
  const donations = await Donation.find({ createdAt: { $gte: from } });
  const claims = await Claim.find({
    donationId: { $in: donations.map((d) => d._id) },
    status: "PICKED_UP",
  });
  const rescuedByDonation = new Map<string, number>();
  for (const c of claims) {
    rescuedByDonation.set(String(c.donationId), (rescuedByDonation.get(String(c.donationId)) ?? 0) + c.quantity);
  }

  const live = donations
    .filter((d) => ["ACTIVE", "PARTIALLY_CLAIMED", "FULLY_CLAIMED", "EXPIRED", "COMPLETED"].includes(d.status))
    .map((d) => {
      const [lng, lat] = d.location.coordinates;
      const urgency = computeUrgency(d);
      let liveState: "ACTIVE" | "URGENT" | "RESCUED" | "EXPIRED" = "ACTIVE";
      if (d.status === "EXPIRED") liveState = "EXPIRED";
      else if (d.status === "COMPLETED" || ((rescuedByDonation.get(d.id) ?? 0) > 0 && d.availableQuantity === 0))
        liveState = "RESCUED";
      else if (urgency.band === "CRITICAL") liveState = "URGENT";
      return {
        id: d.id,
        liveState,
        liveStateLabel:
          liveState === "URGENT"
            ? "Urgent"
            : liveState === "RESCUED"
              ? "Rescued"
              : liveState === "EXPIRED"
                ? "Expired"
                : "Active",
        meals: d.availableQuantity,
        quantity: d.quantity,
        expiresAt: d.expiresAt,
        lat: snap(lat),
        lng: snap(lng),
      };
    });

  const cells = new Map<
    string,
    {
      id: string;
      lat: number;
      lng: number;
      donations: number;
      active: number;
      urgent: number;
      rescuedMeals: number;
      expired: number;
      availableMeals: number;
      pickupMinutes: number[];
      placeName: string;
      latestAt: number;
    }
  >();

  const donationCell = new Map<string, string>();
  const ordered = [...donations].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const d of ordered) {
    const [lng, lat] = d.location.coordinates;
    const id = cellId(lat, lng);
    donationCell.set(d.id, id);
    const cell = cells.get(id) ?? {
      id,
      lat: snap(lat),
      lng: snap(lng),
      donations: 0,
      active: 0,
      urgent: 0,
      rescuedMeals: 0,
      expired: 0,
      availableMeals: 0,
      pickupMinutes: [],
      placeName: "",
      latestAt: 0,
    };
    cell.donations += 1;
    cell.rescuedMeals += rescuedByDonation.get(d.id) ?? 0;
    if (["ACTIVE", "PARTIALLY_CLAIMED"].includes(d.status)) {
      cell.active += 1;
      cell.availableMeals += d.availableQuantity;
      if (computeUrgency(d).band === "CRITICAL") cell.urgent += 1;
    }
    if (d.status === "EXPIRED") cell.expired += 1;
    const addr = d.address?.trim();
    if (addr && d.createdAt.getTime() >= cell.latestAt) {
      cell.placeName = addr;
      cell.latestAt = d.createdAt.getTime();
    }
    cells.set(id, cell);
  }
  for (const c of claims) {
    const cell = cells.get(donationCell.get(String(c.donationId)) ?? "");
    const when = c.pickedUpAt || c.completedAt;
    if (cell && when) cell.pickupMinutes.push((when.getTime() - c.claimedAt.getTime()) / 60000);
  }

  for (const cell of cells.values()) {
    if (cell.placeName) continue;
    const area = nearestSurplusArea(cell.lat, cell.lng);
    if (area) cell.placeName = area.name;
  }

  await Promise.all(
    [...cells.values()]
      .filter((cell) => !cell.placeName)
      .map(async (cell) => {
        cell.placeName = (await reverseAreaName(cell.lat, cell.lng)) || "Approximate area";
      }),
  );

  return {
    range,
    from,
    privacy:
      "Markers are snapped to ~200 m grids. Area names use the latest listing address or an approximate neighborhood, not a live GPS trail.",
    live,
    cells: [...cells.values()].map((c) => ({
      areaId: c.id,
      placeName: c.placeName,
      lat: c.lat,
      lng: c.lng,
      donations: c.donations,
      activeDonations: c.active,
      urgentDonations: c.urgent,
      mealsAvailable: c.availableMeals,
      mealsRescued: c.rescuedMeals,
      expiredDonations: c.expired,
      averageRescueMinutes: c.pickupMinutes.length
        ? Number((c.pickupMinutes.reduce((a, b) => a + b, 0) / c.pickupMinutes.length).toFixed(1))
        : 0,
    })),
  };
}

export async function rescueActivity() {
  const donations = await Donation.find();
  const claims = await Claim.find({ status: "PICKED_UP" });
  const rescuedIds = new Set(claims.map((c) => String(c.donationId)));
  const total = donations.length;
  const level1 = donations.filter((d) => (d.escalationLevel ?? 1) === 1).length;
  const level2 = donations.filter((d) => d.escalationLevel === 2).length;
  const level3 = donations.filter((d) => d.escalationLevel === 3).length;
  const neededEscalation = donations.filter((d) => (d.escalationLevel ?? 1) > 1).length;
  const rescuedAfterEscalation = donations.filter(
    (d) => (d.escalationLevel ?? 1) > 1 && rescuedIds.has(d.id),
  ).length;
  const expiredAfterEscalation = donations.filter(
    (d) => (d.escalationLevel ?? 1) > 1 && d.status === "EXPIRED",
  ).length;

  return {
    totalDonations: total,
    donationsRequiringEscalation: neededEscalation,
    level1Rescues: level1,
    level2Rescues: level2,
    level3Rescues: level3,
    rescuedAfterEscalation,
    expiredAfterEscalation,
    escalationRescueSuccess:
      neededEscalation - expiredAfterEscalation > 0
        ? `${rescuedAfterEscalation} / ${neededEscalation}`
        : "0 / 0",
  };
}

function liveLabel(state: "ACTIVE" | "URGENT" | "RESCUED") {
  if (state === "URGENT") return "Urgent";
  if (state === "RESCUED") return "Rescued";
  return "Active";
}

export async function recipientHeatmap(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    return {
      center: { lat: SURPLUS_AREAS[0].lat, lng: SURPLUS_AREAS[0].lng },
      privacy: "Approximate area only. Exact pickup pin is shown after you claim.",
      live: [] as {
        id: string;
        liveState: "ACTIVE" | "URGENT" | "RESCUED";
        liveStateLabel: string;
        meals: number;
        lat: number;
        lng: number;
      }[],
      surplusAreas: [] as { name: string; meals: number }[],
    };
  }

  const [lng, lat] = user.location.coordinates;
  const nearby = await findNearbyDonations(user.location);
  const from = rangeStart("7d");
  const recent = await Donation.find({ createdAt: { $gte: from } });
  const seen = new Set<string>();
  const live: {
    id: string;
    liveState: "ACTIVE" | "URGENT" | "RESCUED";
    liveStateLabel: string;
    meals: number;
    lat: number;
    lng: number;
  }[] = [];

  for (const d of nearby) {
    const [dlng, dlat] = (d.location as { coordinates: [number, number] }).coordinates;
    const urgent = computeUrgency(d).band === "CRITICAL";
    const id = String(d._id);
    seen.add(id);
    live.push({
      id,
      liveState: urgent ? "URGENT" : "ACTIVE",
      liveStateLabel: liveLabel(urgent ? "URGENT" : "ACTIVE"),
      meals: d.availableQuantity as number,
      lat: snap(dlat),
      lng: snap(dlng),
    });
  }

  const viewKm = maxRescueRadiusKm();
  for (const d of recent) {
    if (d.status !== "COMPLETED") continue;
    const [dlng, dlat] = d.location.coordinates;
    if (haversineKm(lng, lat, dlng, dlat) > viewKm) continue;
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    live.push({
      id: d.id,
      liveState: "RESCUED",
      liveStateLabel: liveLabel("RESCUED"),
      meals: d.quantity,
      lat: snap(dlat),
      lng: snap(dlng),
    });
  }

  const totals = Object.fromEntries(SURPLUS_AREAS.map((a) => [a.name, 0]));
  for (const d of recent) {
    const [dlng, dlat] = d.location.coordinates;
    const area = nearestSurplusArea(dlat, dlng);
    if (area) totals[area.name] += d.quantity;
  }

  const surplusAreas = SURPLUS_AREAS.map((a) => ({ name: a.name, meals: totals[a.name] }))
    .filter((a) => a.meals > 0)
    .sort((a, b) => b.meals - a.meals);

  return {
    center: { lat, lng },
    privacy: "Approximate area only. Exact pickup pin is shown after you claim.",
    live,
    surplusAreas,
  };
}
