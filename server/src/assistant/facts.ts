import { Claim } from "../models/Claim.js";
import { Donation } from "../models/Donation.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { config } from "../config.js";
import { donorDashboard, recipientDashboard } from "../services/dashboard.js";
import { findNearbyDonations } from "../services/geo.js";
import type { LastNotificationFact, NearbyListingFact, PickupFact, AssistantFacts } from "./types.js";
import type { ClaimDoc } from "../models/Claim.js";
import type { DonationDoc } from "../models/Donation.js";

const OPEN_STATUSES = ["CLAIMED", "PICKUP_PENDING"] as const;

function roundKm(meters: number) {
  return Math.round((meters / 1000) * 10) / 10;
}

async function mapPickupFacts(claims: ClaimDoc[], includeDonor: boolean): Promise<PickupFact[]> {
  if (!claims.length) return [];
  const donations = await Donation.find({ _id: { $in: claims.map((c) => c.donationId) } });
  const recipientIds = claims.map((c) => c.recipientId);
  const donorIds = includeDonor ? donations.map((d) => d.donorId) : [];
  const users = await User.find({ _id: { $in: [...recipientIds, ...donorIds] } });
  return claims.map((claim) => {
    const donation = donations.find((d) => String(d._id) === String(claim.donationId));
    const recipient = users.find((u) => String(u._id) === String(claim.recipientId));
    const donor = donation ? users.find((u) => String(u._id) === String(donation.donorId)) : undefined;
    return {
      claimId: String(claim._id),
      donationId: String(claim.donationId),
      foodName: donation?.foodName ?? "food",
      category: donation?.category,
      quantity: claim.quantity,
      address: donation?.address,
      pickupDeadline: claim.pickupDeadline.toISOString(),
      pickupInstructions: donation?.pickupInstructions,
      recipientName: recipient?.organizationName || recipient?.name,
      donorName: donor?.organizationName || donor?.name,
      status: claim.status,
      allergens: donation?.allergens ?? [],
    };
  });
}

async function loadLastNotifications(pickups: PickupFact[], userId: string): Promise<LastNotificationFact[]> {
  const claimIds = [...new Set(pickups.map((p) => p.claimId).filter(Boolean))];
  if (!claimIds.length) return [];
  const notes = await Notification.find({
    claimId: { $in: claimIds },
    recipientId: { $ne: userId },
    type: { $in: ["PICKUP_RUNNING_LATE", "PICKUP_INSTRUCTIONS_UPDATED", "PICKUP_ARRIVED", "PICKUP_MESSAGE"] },
  })
    .sort({ createdAt: -1 })
    .limit(8);
  if (!notes.length) return [];
  const users = await User.find({ _id: { $in: notes.map((n) => n.recipientId) } });
  return notes.map((note) => {
    const who = users.find((u) => String(u._id) === String(note.recipientId));
    return {
      type: note.type,
      title: note.title,
      sentTo: who?.organizationName || who?.name || "the other party",
      at: note.createdAt.toISOString(),
    };
  });
}

async function loadNearbyListings(userId: string): Promise<{
  nearbyListings: NearbyListingFact[];
  nearbyCount: number;
  nearbyRadiusKm: number;
}> {
  const user = await User.findById(userId);
  if (!user?.location) return { nearbyListings: [], nearbyCount: 0, nearbyRadiusKm: config.defaultRadiusKm };
  try {
    const donations = (await findNearbyDonations(user.location)) as Array<
      DonationDoc & { distanceMeters?: number; availableQuantity?: number }
    >;
    const nearbyListings = donations.slice(0, 5).map((d) => ({
      foodName: d.foodName,
      quantity: d.availableQuantity ?? d.quantity,
      distanceKm: roundKm(d.distanceMeters ?? 0),
    }));
    return {
      nearbyListings,
      nearbyCount: donations.length,
      nearbyRadiusKm: config.defaultRadiusKm,
    };
  } catch {
    return { nearbyListings: [], nearbyCount: 0, nearbyRadiusKm: config.defaultRadiusKm };
  }
}

export async function loadAssistantFacts(userId: string, role: string): Promise<AssistantFacts> {
  const user = await User.findById(userId);
  const displayName = user?.organizationName || user?.name || "there";

  if (role === "RECIPIENT") {
    const dash = await recipientDashboard(userId);
    const openClaims = await Claim.find({
      recipientId: userId,
      status: { $in: OPEN_STATUSES },
    }).sort({ claimedAt: -1 });
    const recentClaims = await Claim.find({ recipientId: userId }).sort({ claimedAt: -1 }).limit(5);
    const openPickups = await mapPickupFacts(openClaims, true);
    const recentPickups = await mapPickupFacts(recentClaims, true);
    const lastNotifications = await loadLastNotifications([...openPickups, ...recentPickups], userId);
    const nearby = await loadNearbyListings(userId);
    return {
      role,
      displayName,
      mealsPickedUp: dash.mealsPickedUp,
      activeClaims: dash.activeClaims,
      openPickups,
      recentPickups,
      lastNotifications,
      ...nearby,
    };
  }

  if (role === "DONOR") {
    const dash = await donorDashboard(userId);
    const donations = await Donation.find({
      donorId: userId,
      status: { $in: ["ACTIVE", "PARTIALLY_CLAIMED", "FULLY_CLAIMED"] },
    }).sort({ createdAt: -1 });
    const donationIds = donations.map((d) => d._id);
    const allDonationIds = (await Donation.find({ donorId: userId }).select("_id")).map((d) => d._id);
    const openClaims = await Claim.find({
      donationId: { $in: donationIds },
      status: { $in: OPEN_STATUSES },
    }).sort({ claimedAt: -1 });
    const recentClaims = await Claim.find({ donationId: { $in: allDonationIds } })
      .sort({ claimedAt: -1 })
      .limit(5);
    const openPickups = await mapPickupFacts(openClaims, false);
    const recentPickups = await mapPickupFacts(recentClaims, false);
    const lastNotifications = await loadLastNotifications([...openPickups, ...recentPickups], userId);
    return {
      role,
      displayName,
      mealsRescued: dash.mealsRescued,
      activeDonations: dash.activeDonations,
      openPickups,
      recentPickups,
      lastNotifications,
    };
  }

  return { role, displayName, openPickups: [] };
}

function compactPickup(p: PickupFact) {
  return {
    claimId: p.claimId,
    donationId: p.donationId,
    foodName: p.foodName,
    category: p.category,
    quantity: p.quantity,
    address: p.address,
    pickupDeadline: p.pickupDeadline,
    pickupInstructions: p.pickupInstructions,
    recipientName: p.recipientName,
    donorName: p.donorName,
    status: p.status,
    allergens: p.allergens ?? [],
  };
}

export function factsForPrompt(facts: AssistantFacts) {
  return JSON.stringify(
    {
      role: facts.role,
      displayName: facts.displayName,
      mealsPickedUp: facts.mealsPickedUp,
      mealsRescued: facts.mealsRescued,
      activeClaims: facts.activeClaims,
      activeDonations: facts.activeDonations,
      openPickups: facts.openPickups.map(compactPickup),
      recentPickups: (facts.recentPickups ?? []).map(compactPickup),
      lastNotifications: facts.lastNotifications ?? [],
      nearbyListings: facts.nearbyListings ?? [],
      nearbyCount: facts.nearbyCount,
      nearbyRadiusKm: facts.nearbyRadiusKm,
    },
    null,
    0,
  );
}
