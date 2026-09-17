import { Claim } from "../models/Claim.js";
import { Donation } from "../models/Donation.js";
import { User } from "../models/User.js";
import { config } from "../config.js";
import { expireStaleDonations } from "./expiration.js";

const KG_PER_MEAL = 0.4;
const INR_PER_MEAL = 50;

export const impactAssumptions = {
  kgPerMeal: KG_PER_MEAL,
  inrPerMeal: INR_PER_MEAL,
  note: "Estimated using configurable assumptions. Not a scientific measurement.",
};

export async function rescuedMeals(match: Record<string, unknown> = {}) {
  const rows = await Claim.aggregate<{ total: number }>([
    { $match: { status: "PICKED_UP", ...match } },
    { $group: { _id: null, total: { $sum: "$quantity" } } },
  ]);
  return rows[0]?.total ?? 0;
}

export async function publicImpact() {
  const week = new Date();
  week.setHours(0, 0, 0, 0);
  week.setDate(week.getDate() - 6);
  const [mealsRescued, mealsRescuedThisWeek, totalDonors, totalNgos] = await Promise.all([
    rescuedMeals(),
    rescuedMeals({ completedAt: { $gte: week } }),
    User.countDocuments({ role: "DONOR" }),
    User.countDocuments({ role: "RECIPIENT", recipientType: "NGO" }),
  ]);
  return {
    mealsRescued,
    mealsRescuedThisWeek,
    totalDonors,
    totalNgos,
    defaultRadiusKm: config.defaultRadiusKm,
    listingWindowHours: 1,
  };
}

export async function donorDashboard(donorId: string) {
  await expireStaleDonations();
  const donations = await Donation.find({ donorId }).sort({ createdAt: -1 });
  const donationIds = donations.map((d) => d._id);
  const claims = await Claim.find({ donationId: { $in: donationIds } });

  const mealsDonated = donations.reduce((s, d) => s + d.quantity, 0);
  const mealsRescued = claims.filter((c) => c.status === "PICKED_UP").reduce((s, c) => s + c.quantity, 0);
  const byStatus = Object.fromEntries(
    ["ACTIVE", "PARTIALLY_CLAIMED", "FULLY_CLAIMED", "EXPIRED", "COMPLETED", "CANCELLED"].map((s) => [
      s,
      donations.filter((d) => d.status === s).length,
    ]),
  );

  const now = Date.now();
  const seriesMap = new Map<string, { donated: number; rescued: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    seriesMap.set(key, { donated: 0, rescued: 0 });
  }
  for (const d of donations) {
    const key = d.createdAt.toISOString().slice(0, 10);
    const row = seriesMap.get(key);
    if (row) row.donated += d.quantity;
  }
  for (const c of claims) {
    if (c.status !== "PICKED_UP" || !c.completedAt) continue;
    const key = c.completedAt.toISOString().slice(0, 10);
    const row = seriesMap.get(key);
    if (row) row.rescued += c.quantity;
  }

  return {
    mealsDonated,
    mealsRescued,
    mealsExpiredUnclaimed: donations
      .filter((d) => d.status === "EXPIRED")
      .reduce((s, d) => s + d.availableQuantity, 0),
    activeDonations: donations.filter((d) => ["ACTIVE", "PARTIALLY_CLAIMED"].includes(d.status)).length,
    completedDonations: donations.filter((d) => d.status === "COMPLETED").length,
    expiredDonations: donations.filter((d) => d.status === "EXPIRED").length,
    totalDonations: donations.length,
    rescueRate: mealsDonated ? Number(((mealsRescued / mealsDonated) * 100).toFixed(1)) : 0,
    statusDistribution: byStatus,
    mealsOverTime: [...seriesMap.entries()].map(([date, v]) => ({ date, ...v })),
    impact: {
      estimatedKgPrevented: Number((mealsRescued * KG_PER_MEAL).toFixed(1)),
      estimatedValueInr: mealsRescued * INR_PER_MEAL,
      assumptions: impactAssumptions,
    },
    recentDonations: donations.slice(0, 8),
  };
}

export async function recipientDashboard(recipientId: string) {
  const claims = await Claim.find({ recipientId }).sort({ claimedAt: -1 });
  const mealsClaimed = claims.reduce((s, c) => s + c.quantity, 0);
  const mealsPickedUp = claims.filter((c) => c.status === "PICKED_UP").reduce((s, c) => s + c.quantity, 0);
  return {
    mealsClaimed,
    mealsPickedUp,
    activeClaims: claims.filter((c) => c.status === "PICKUP_PENDING").length,
    totalClaims: claims.length,
    recentClaims: claims.slice(0, 8),
  };
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function adminDashboard() {
  await expireStaleDonations();
  const [donors, recipients, ngos, donations, claims] = await Promise.all([
    User.countDocuments({ role: "DONOR" }),
    User.countDocuments({ role: "RECIPIENT" }),
    User.countDocuments({ role: "RECIPIENT", recipientType: "NGO" }),
    Donation.find(),
    Claim.find(),
  ]);

  const mealsDonated = donations.reduce((s, d) => s + d.quantity, 0);
  const mealsRescued = claims.filter((c) => c.status === "PICKED_UP").reduce((s, c) => s + c.quantity, 0);
  const activeDonations = donations.filter((d) => ["ACTIVE", "PARTIALLY_CLAIMED"].includes(d.status)).length;
  const activeMeals = donations
    .filter((d) => ["ACTIVE", "PARTIALLY_CLAIMED"].includes(d.status))
    .reduce((s, d) => s + d.availableQuantity, 0);

  const today = startOfDay();
  const week = new Date(today.getTime() - 6 * 86400000);
  const month = new Date(today.getTime() - 29 * 86400000);

  const rescuedIn = (from: Date) =>
    claims.filter((c) => c.status === "PICKED_UP" && c.completedAt && c.completedAt >= from).reduce((s, c) => s + c.quantity, 0);

  const pickupTimes = claims
    .filter((c) => c.status === "PICKED_UP" && c.completedAt)
    .map((c) => (c.completedAt!.getTime() - c.claimedAt.getTime()) / 60000);

  const donorTotals = new Map<string, number>();
  for (const d of donations) {
    const id = String(d.donorId);
    donorTotals.set(id, (donorTotals.get(id) ?? 0) + d.quantity);
  }
  const recipientTotals = new Map<string, number>();
  for (const c of claims) {
    if (c.status !== "PICKED_UP") continue;
    const id = String(c.recipientId);
    recipientTotals.set(id, (recipientTotals.get(id) ?? 0) + c.quantity);
  }

  const topDonorIds = [...donorTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topRecipientIds = [...recipientTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const users = await User.find({
    _id: { $in: [...topDonorIds.map(([id]) => id), ...topRecipientIds.map(([id]) => id)] },
  });
  const userName = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u?.organizationName || u?.name || "Unknown";
  };

  const statusDistribution = Object.fromEntries(
    ["ACTIVE", "PARTIALLY_CLAIMED", "FULLY_CLAIMED", "EXPIRED", "COMPLETED", "CANCELLED"].map((s) => [
      s,
      donations.filter((d) => d.status === s).length,
    ]),
  );

  return {
    mealsDonated,
    mealsRescued,
    activeMeals,
    totalDonations: donations.length,
    activeDonations,
    totalDonors: donors,
    totalRecipients: recipients,
    totalNgos: ngos,
    rescueRate: mealsDonated ? Number(((mealsRescued / mealsDonated) * 100).toFixed(1)) : 0,
    mealsRescuedToday: rescuedIn(today),
    mealsRescuedThisWeek: rescuedIn(week),
    mealsRescuedThisMonth: rescuedIn(month),
    averagePickupMinutes: pickupTimes.length
      ? Number((pickupTimes.reduce((a, b) => a + b, 0) / pickupTimes.length).toFixed(1))
      : 0,
    mostActiveDonors: topDonorIds.map(([id, meals]) => ({ id, name: userName(id), meals })),
    mostActiveRecipients: topRecipientIds.map(([id, meals]) => ({ id, name: userName(id), meals })),
    statusDistribution,
    mapDonations: donations.map((d) => {
      const cell = 0.002;
      const snap = (n: number) => Number((Math.round(n / cell) * cell).toFixed(4));
      return {
        id: d.id,
        foodName: d.foodName,
        status: d.status,
        quantity: d.quantity,
        availableQuantity: d.availableQuantity,
        lng: snap(d.location.coordinates[0]),
        lat: snap(d.location.coordinates[1]),
      };
    }),
    impact: {
      estimatedKgPrevented: Number((mealsRescued * KG_PER_MEAL).toFixed(1)),
      estimatedValueInr: mealsRescued * INR_PER_MEAL,
      assumptions: impactAssumptions,
    },
  };
}
