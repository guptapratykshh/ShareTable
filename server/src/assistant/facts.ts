import { Claim } from "../models/Claim.js";
import { Donation } from "../models/Donation.js";
import { User } from "../models/User.js";
import { donorDashboard, recipientDashboard } from "../services/dashboard.js";
import type { AssistantFacts, OpenPickupFact } from "./types.js";

const OPEN_STATUSES = ["CLAIMED", "PICKUP_PENDING"] as const;

export async function loadAssistantFacts(userId: string, role: string): Promise<AssistantFacts> {
  const user = await User.findById(userId);
  const displayName = user?.organizationName || user?.name || "there";

  if (role === "RECIPIENT") {
    const dash = await recipientDashboard(userId);
    const claims = await Claim.find({
      recipientId: userId,
      status: { $in: OPEN_STATUSES },
    }).sort({ claimedAt: -1 });
    const donations = await Donation.find({ _id: { $in: claims.map((c) => c.donationId) } });
    const openPickups: OpenPickupFact[] = claims.map((claim) => {
      const donation = donations.find((d) => d.id === String(claim.donationId));
      return {
        claimId: claim.id,
        donationId: String(claim.donationId),
        foodName: donation?.foodName ?? "food",
        quantity: claim.quantity,
        address: donation?.address,
        pickupDeadline: claim.pickupDeadline.toISOString(),
        pickupInstructions: donation?.pickupInstructions,
        allergens: donation?.allergens ?? [],
      };
    });
    return {
      role,
      displayName,
      mealsPickedUp: dash.mealsPickedUp,
      activeClaims: dash.activeClaims,
      openPickups,
    };
  }

  if (role === "DONOR") {
    const dash = await donorDashboard(userId);
    const donations = await Donation.find({
      donorId: userId,
      status: { $in: ["ACTIVE", "PARTIALLY_CLAIMED", "FULLY_CLAIMED"] },
    }).sort({ createdAt: -1 });
    const claims = await Claim.find({
      donationId: { $in: donations.map((d) => d._id) },
      status: { $in: OPEN_STATUSES },
    }).sort({ claimedAt: -1 });
    const recipients = await User.find({ _id: { $in: claims.map((c) => c.recipientId) } });
    const openPickups: OpenPickupFact[] = claims.map((claim) => {
      const donation = donations.find((d) => d.id === String(claim.donationId));
      const recipient = recipients.find((u) => u.id === String(claim.recipientId));
      return {
        claimId: claim.id,
        donationId: String(claim.donationId),
        foodName: donation?.foodName ?? "food",
        quantity: claim.quantity,
        address: donation?.address,
        pickupDeadline: claim.pickupDeadline.toISOString(),
        pickupInstructions: donation?.pickupInstructions,
        recipientName: recipient?.organizationName || recipient?.name,
        allergens: donation?.allergens ?? [],
      };
    });
    return {
      role,
      displayName,
      mealsRescued: dash.mealsRescued,
      activeDonations: dash.activeDonations,
      openPickups,
    };
  }

  return { role, displayName, openPickups: [] };
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
      openPickups: facts.openPickups.map((p) => ({
        claimId: p.claimId,
        donationId: p.donationId,
        foodName: p.foodName,
        quantity: p.quantity,
        address: p.address,
        pickupDeadline: p.pickupDeadline,
        pickupInstructions: p.pickupInstructions,
        recipientName: p.recipientName,
        allergens: p.allergens ?? [],
      })),
    },
    null,
    0,
  );
}
