import mongoose from "mongoose";
import { Claim } from "../models/Claim.js";
import { Donation } from "../models/Donation.js";

export async function donorAnalytics(donorId: string) {
  const donorObj = new mongoose.Types.ObjectId(donorId);
  const donations = await Donation.find({ donorId: donorObj }).select(
    "quantity status category createdAt availableQuantity",
  );
  const donationIds = donations.map((d) => d._id);

  const [claimAgg] = await Claim.aggregate<{
    claimed: number;
    rescued: number;
    avgPickupMinutes: number | null;
  }>([
    { $match: { donationId: { $in: donationIds } } },
    {
      $group: {
        _id: null,
        claimed: { $sum: "$quantity" },
        rescued: {
          $sum: { $cond: [{ $eq: ["$status", "PICKED_UP"] }, "$quantity", 0] },
        },
        pickupMinutes: {
          $push: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "PICKED_UP"] },
                  { $ne: [{ $ifNull: ["$pickedUpAt", "$completedAt"] }, null] },
                ],
              },
              {
                $divide: [
                  {
                    $subtract: [{ $ifNull: ["$pickedUpAt", "$completedAt"] }, "$claimedAt"],
                  },
                  60000,
                ],
              },
              "$$REMOVE",
            ],
          },
        },
      },
    },
    {
      $project: {
        claimed: 1,
        rescued: 1,
        avgPickupMinutes: { $avg: "$pickupMinutes" },
      },
    },
  ]);

  const firstClaim = await Claim.aggregate<{ avgMinutes: number }>([
    { $match: { donationId: { $in: donationIds } } },
    { $sort: { claimedAt: 1 } },
    { $group: { _id: "$donationId", firstClaim: { $first: "$claimedAt" } } },
    {
      $lookup: {
        from: "donations",
        localField: "_id",
        foreignField: "_id",
        as: "donation",
      },
    },
    { $unwind: "$donation" },
    {
      $project: {
        minutes: { $divide: [{ $subtract: ["$firstClaim", "$donation.createdAt"] }, 60000] },
      },
    },
    { $group: { _id: null, avgMinutes: { $avg: "$minutes" } } },
  ]);

  const mealsDonated = donations.reduce((s, d) => s + d.quantity, 0);
  const mealsClaimed = claimAgg?.claimed ?? 0;
  const mealsRescued = claimAgg?.rescued ?? 0;
  const mealsUnrescued = Math.max(0, mealsDonated - mealsRescued);
  const categoryCounts = new Map<string, number>();
  for (const d of donations) {
    categoryCounts.set(d.category, (categoryCounts.get(d.category) ?? 0) + d.quantity);
  }
  const mostCommonCategory =
    [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const now = Date.now();
  const daily = new Map<string, { donated: number; rescued: number }>();
  for (let i = 6; i >= 0; i--) {
    daily.set(new Date(now - i * 86400000).toISOString().slice(0, 10), { donated: 0, rescued: 0 });
  }
  for (const d of donations) {
    const key = d.createdAt.toISOString().slice(0, 10);
    const row = daily.get(key);
    if (row) row.donated += d.quantity;
  }
  const picked = await Claim.find({
    donationId: { $in: donationIds },
    status: "PICKED_UP",
  }).select("quantity pickedUpAt completedAt");
  for (const c of picked) {
    const when = c.pickedUpAt || c.completedAt;
    if (!when) continue;
    const key = when.toISOString().slice(0, 10);
    const row = daily.get(key);
    if (row) row.rescued += c.quantity;
  }

  const weekly = [3, 2, 1, 0].map((w) => {
    const end = new Date(now - w * 7 * 86400000);
    const start = new Date(end.getTime() - 7 * 86400000);
    const donated = donations
      .filter((d) => d.createdAt >= start && d.createdAt < end)
      .reduce((s, d) => s + d.quantity, 0);
    const rescued = picked
      .filter((c) => {
        const when = c.pickedUpAt || c.completedAt;
        return when && when >= start && when < end;
      })
      .reduce((s, c) => s + c.quantity, 0);
    return {
      week: `Week ${4 - w}`,
      donated,
      rescued,
      rescueRate: donated ? Number(((rescued / donated) * 100).toFixed(1)) : 0,
    };
  });

  const statusDistribution = Object.fromEntries(
    ["ACTIVE", "PARTIALLY_CLAIMED", "FULLY_CLAIMED", "EXPIRED", "COMPLETED", "CANCELLED"].map((s) => [
      s,
      donations.filter((d) => d.status === s).length,
    ]),
  );

  return {
    demoDataLabel: "Demo Data",
    mealsDonated,
    mealsClaimed,
    mealsRescued,
    mealsUnrescued,
    rescueRate: mealsDonated ? Number(((mealsRescued / mealsDonated) * 100).toFixed(1)) : 0,
    averagePickupMinutes: claimAgg?.avgPickupMinutes != null ? Number(claimAgg.avgPickupMinutes.toFixed(1)) : 0,
    averageMinutesToFirstClaim: firstClaim[0]?.avgMinutes != null ? Number(firstClaim[0].avgMinutes.toFixed(1)) : 0,
    totalDonations: donations.length,
    mostCommonCategory,
    mealsOverTime: [...daily.entries()].map(([date, v]) => ({ date, ...v })),
    rescueRateByWeek: weekly,
    statusDistribution,
  };
}
