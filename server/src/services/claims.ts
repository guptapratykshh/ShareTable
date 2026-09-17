import { Claim } from "../models/Claim.js";
import { Donation } from "../models/Donation.js";
import type { DonationDoc } from "../models/Donation.js";
import { User } from "../models/User.js";
import { AppError, generatePickupCode } from "../utils.js";
import { expireDonationIfNeeded } from "./expiration.js";
import { escalateDonationIfNeeded } from "./escalation.js";
import { distanceBetween, isWithinRadius } from "./geo.js";
import { notifyUser } from "./notifications.js";

export async function maybeCompleteDonation(donation: DonationDoc): Promise<DonationDoc> {
  if (donation.availableQuantity > 0) return donation;
  if (donation.status === "CANCELLED" || donation.status === "EXPIRED") return donation;

  const pending = await Claim.countDocuments({
    donationId: donation._id,
    status: { $in: ["CLAIMED", "PICKUP_PENDING"] },
  });

  if (pending === 0 && donation.availableQuantity === 0) {
    donation.status = "COMPLETED";
    await donation.save();
  }
  return donation;
}

export async function claimMeals(opts: {
  donationId: string;
  recipientId: string;
  quantity: number;
}) {
  const { donationId, recipientId, quantity } = opts;
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError("Claim quantity must be a positive whole number.");
  }

  const recipient = await User.findById(recipientId);
  if (!recipient || recipient.role !== "RECIPIENT") {
    throw new AppError("Only registered recipients can claim meals.", 403);
  }

  const donation = await Donation.findById(donationId);
  if (!donation) throw new AppError("Donation not found.", 404);
  await expireDonationIfNeeded(donation);
  await escalateDonationIfNeeded(donation);

  if (donation.status === "EXPIRED") {
    throw new AppError("Donation has expired.");
  }
  if (donation.status === "CANCELLED") {
    throw new AppError("This donation was cancelled.");
  }
  if (donation.status === "COMPLETED" || donation.status === "FULLY_CLAIMED") {
    throw new AppError("This donation has already been fully claimed.");
  }
  const radiusKm = donation.currentRadiusKm ?? 2.5;
  if (!isWithinRadius(recipient.location, donation.location, radiusKm)) {
    throw new AppError("You are outside the allowed pickup radius.");
  }

  const openClaim = await Claim.findOne({
    donationId: donation._id,
    recipientId: recipient._id,
    status: { $in: ["CLAIMED", "PICKUP_PENDING"] },
  });
  if (openClaim) {
    throw new AppError(
      "You already have a reservation for this listing. Remaining meals stay available for other recipients until your pickup is recorded.",
    );
  }

  const updated = await Donation.findOneAndUpdate(
    {
      _id: donation._id,
      status: { $in: ["ACTIVE", "PARTIALLY_CLAIMED"] },
      availableQuantity: { $gte: quantity },
      expiresAt: { $gt: new Date() },
    },
    { $inc: { availableQuantity: -quantity } },
    { returnDocument: "after" },
  );

  if (!updated) {
    const current = await Donation.findById(donationId);
    if (!current) throw new AppError("Donation not found.", 404);
    await expireDonationIfNeeded(current);
    if (current.status === "EXPIRED" || current.expiresAt.getTime() <= Date.now()) {
      throw new AppError("Donation has expired.");
    }
    if (current.availableQuantity === 0) {
      throw new AppError("This donation has already been fully claimed.");
    }
    throw new AppError(
      `Only ${current.availableQuantity} meals remain. Another recipient claimed some meals just before you.`,
    );
  }

  if (updated.availableQuantity < 0) {
    updated.availableQuantity = 0;
  }

  updated.status = updated.availableQuantity === 0 ? "FULLY_CLAIMED" : "PARTIALLY_CLAIMED";
  await updated.save();

  const claim = await Claim.create({
    donationId: updated._id,
    recipientId: recipient._id,
    quantity,
    status: "PICKUP_PENDING",
    claimCode: generatePickupCode(),
    claimedAt: new Date(),
    pickupDeadline: updated.expiresAt,
  });

  const recipientName = recipient.organizationName || recipient.name;
  await notifyUser({
    recipientId: String(updated.donorId),
    type: "DONATION_CLAIMED",
    title: "Meals claimed",
    message: `${recipientName} claimed ${quantity} meal${quantity === 1 ? "" : "s"} from ${updated.foodName}. ${updated.availableQuantity} remaining.`,
    donationId: String(updated._id),
    claimId: String(claim._id),
  });

  await notifyUser({
    recipientId: String(recipient._id),
    type: "CLAIM_CONFIRMED",
    title: "Pickup confirmed",
    message: `${quantity} meal${quantity === 1 ? "" : "s"} reserved. Show pickup code ${claim.claimCode} at ${updated.address}.`,
    donationId: String(updated._id),
    claimId: String(claim._id),
  });

  const distanceKm = distanceBetween(recipient.location, updated.location);

  return { claim, donation: updated, distanceKm };
}

export async function completePickup(opts: {
  claimId: string;
  actorId: string;
  actorRole: string;
  claimCode?: string;
}) {
  const claim = await Claim.findById(opts.claimId);
  if (!claim) throw new AppError("Claim not found.", 404);

  const donation = await Donation.findById(claim.donationId);
  if (!donation) throw new AppError("Donation not found.", 404);

  const isDonor = opts.actorRole === "DONOR" && String(donation.donorId) === opts.actorId;
  const isAdmin = opts.actorRole === "ADMIN";
  if (opts.actorRole === "RECIPIENT") {
    throw new AppError("Only the donor can confirm pickup.", 403);
  }
  if (!isDonor && !isAdmin) {
    throw new AppError("You cannot complete this pickup.", 403);
  }

  if (claim.status === "PICKED_UP") {
    return { claim, donation };
  }
  if (claim.status === "CANCELLED") {
    throw new AppError("This claim was cancelled.");
  }

  const entered = opts.claimCode?.trim().toUpperCase();
  if (!entered) {
    throw new AppError("Pickup code is required.");
  }
  if (entered !== claim.claimCode.toUpperCase()) {
    throw new AppError("Pickup code does not match.");
  }

  claim.status = "PICKED_UP";
  const pickedUpAt = new Date();
  claim.completedAt = pickedUpAt;
  claim.pickedUpAt = pickedUpAt;
  claim.pickupDurationMinutes = Number(
    ((pickedUpAt.getTime() - claim.claimedAt.getTime()) / 60_000).toFixed(1),
  );
  await claim.save();

  const completed = await maybeCompleteDonation(donation);

  const recipient = await User.findById(claim.recipientId);

  await notifyUser({
    recipientId: String(donation.donorId),
    type: "DONATION_COMPLETED",
    title: "Pickup completed",
    message: `${claim.quantity} meal${claim.quantity === 1 ? "" : "s"} picked up by ${recipient?.organizationName || recipient?.name || "recipient"}.`,
    donationId: String(donation._id),
    claimId: String(claim._id),
  });

  await notifyUser({
    recipientId: String(claim.recipientId),
    type: "DONATION_COMPLETED",
    title: "Pickup recorded",
    message: `${claim.quantity} meal${claim.quantity === 1 ? "" : "s"} marked as picked up from ${donation.foodName}.`,
    donationId: String(donation._id),
    claimId: String(claim._id),
  });

  return { claim, donation: completed };
}

export async function cancelDonation(donationId: string, donorId: string) {
  const donation = await Donation.findById(donationId);
  if (!donation) throw new AppError("Donation not found.", 404);
  if (String(donation.donorId) !== donorId) {
    throw new AppError("You can only cancel your own donations.", 403);
  }
  if (["COMPLETED", "CANCELLED"].includes(donation.status)) {
    throw new AppError("This donation can no longer be cancelled.");
  }

  donation.status = "CANCELLED";
  await donation.save();
  await Claim.updateMany(
    { donationId: donation._id, status: { $in: ["CLAIMED", "PICKUP_PENDING"] } },
    { $set: { status: "CANCELLED" } },
  );
  return donation;
}
