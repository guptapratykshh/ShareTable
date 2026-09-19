import { Claim, type ClaimDoc } from "../models/Claim.js";
import { Donation } from "../models/Donation.js";
import { User } from "../models/User.js";
import type { ClaimStatus } from "../types.js";
import { notifyUser } from "../services/notifications.js";
import { AppError } from "../utils.js";
import {
  arriveAtDonorMessage,
  arrivedOtherMessage,
  instructionsRecipientMessage,
  lateDonorMessage,
  relayOtherMessage,
  sanitizeInstructions,
  sanitizeRelayMessage,
  successCopy,
} from "./copy.js";
import type { PendingActionRecord } from "./types.js";

const OPEN_STATUSES: ClaimStatus[] = ["CLAIMED", "PICKUP_PENDING"];

function isOpenStatus(status: string) {
  return OPEN_STATUSES.includes(status as ClaimStatus);
}

function delayMinutesAfterDeadline(deadline: Date, arriveAtMinutes: number) {
  const arrive = new Date(deadline);
  arrive.setHours(Math.floor(arriveAtMinutes / 60), arriveAtMinutes % 60, 0, 0);
  // If the clock time is far earlier than the deadline day-shift, keep same calendar day as deadline.
  const diffMs = arrive.getTime() - deadline.getTime();
  if (diffMs <= 0) return 0;
  return Math.min(180, Math.max(1, Math.ceil(diffMs / 60_000)));
}

function isObjectId(value?: string): value is string {
  return Boolean(value && /^[a-f0-9]{24}$/i.test(value));
}

export function extractHintIds(text: string) {
  return [...text.matchAll(/\b[a-f0-9]{24}\b/gi)].map((m) => m[0]);
}

async function loadOpenClaim(claimId: string) {
  if (!isObjectId(claimId)) return null;
  const claim = await Claim.findById(claimId);
  if (!claim || !isOpenStatus(claim.status)) return null;
  return claim;
}

export async function resolveOwnedOpenClaim(opts: {
  userId: string;
  role: string;
  hintClaimId?: string;
  hintDonationId?: string;
}): Promise<ClaimDoc | null> {
  if (opts.hintClaimId) {
    const hinted = await loadOpenClaim(opts.hintClaimId);
    if (hinted) {
      const donation = await Donation.findById(hinted.donationId);
      const recipientOwned = opts.role === "RECIPIENT" && String(hinted.recipientId) === opts.userId;
      const donorOwned = opts.role === "DONOR" && donation && String(donation.donorId) === opts.userId;
      if ((recipientOwned || donorOwned) && (!opts.hintDonationId || String(hinted.donationId) === opts.hintDonationId)) return hinted;
    }
    return null;
  }

  if (opts.role === "RECIPIENT") {
    return Claim.findOne({
      recipientId: opts.userId,
      status: { $in: OPEN_STATUSES },
    }).sort({ claimedAt: -1 });
  }

  if (opts.role === "DONOR") {
    const donationFilter: Record<string, unknown> = { donorId: opts.userId };
    if (opts.hintDonationId && isObjectId(opts.hintDonationId)) {
      const hintedDonation = await Donation.findById(opts.hintDonationId);
      if (hintedDonation && String(hintedDonation.donorId) === opts.userId) {
        donationFilter._id = hintedDonation._id;
      } else {
        return null;
      }
    }
    const donations = await Donation.find(donationFilter).select("_id");
    return Claim.findOne({
      donationId: { $in: donations.map((d) => d._id) },
      status: { $in: OPEN_STATUSES },
    }).sort({ claimedAt: -1 });
  }

  return null;
}

export async function executePendingAction(opts: {
  userId: string;
  role: string;
  pending: PendingActionRecord;
}) {
  if (opts.pending.userId !== opts.userId) {
    throw new AppError("You cannot confirm this action.", 403);
  }

  const claim = await resolveOwnedOpenClaim({
    userId: opts.userId,
    role: opts.role,
    hintClaimId: opts.pending.claimId,
    hintDonationId: opts.pending.donationId,
  });

  if (opts.pending.kind === "LATE") {
    return executeLate({
      userId: opts.userId,
      role: opts.role,
      claim,
      delayMinutes: opts.pending.delayMinutes,
      arriveAtLabel: opts.pending.arriveAtLabel,
      arriveAtMinutes: opts.pending.arriveAtMinutes,
    });
  }
  if (opts.pending.kind === "UPDATE_INSTRUCTIONS") {
    return executeUpdateInstructions({
      userId: opts.userId,
      role: opts.role,
      claim,
      instructions: opts.pending.instructions,
    });
  }
  if (opts.pending.kind === "RELAY") {
    return executeRelay({
      userId: opts.userId,
      role: opts.role,
      claim,
      relayMessage: opts.pending.relayMessage,
    });
  }
  return executeArrived({ userId: opts.userId, role: opts.role, claim });
}

async function executeLate(opts: {
  userId: string;
  role: string;
  claim: ClaimDoc | null;
  delayMinutes?: number;
  arriveAtLabel?: string;
  arriveAtMinutes?: number;
}) {
  if (opts.role !== "RECIPIENT") {
    throw new AppError("Only the recipient can send a late update.", 403);
  }
  const claim = opts.claim ? await Claim.findById(opts.claim._id) : null;
  if (!claim || String(claim.recipientId) !== opts.userId || !isOpenStatus(claim.status)) {
    throw new AppError("You cannot send a late update for this pickup.", 403);
  }
  const donation = await Donation.findById(claim.donationId);
  if (!donation) throw new AppError("Donation not found.", 404);

  const recipient = await User.findById(claim.recipientId);
  const org = recipient?.organizationName || recipient?.name || "The recipient";

  if (opts.arriveAtLabel && opts.arriveAtMinutes != null) {
    const lateBy = delayMinutesAfterDeadline(claim.pickupDeadline, opts.arriveAtMinutes);
    if (lateBy <= 0) {
      await notifyUser({
        recipientId: String(donation.donorId),
        type: "PICKUP_RUNNING_LATE",
        title: "Pickup arrival time",
        message: arriveAtDonorMessage(org, opts.arriveAtLabel, claim.quantity),
        donationId: String(donation._id),
        claimId: String(claim._id),
      });
      return { reply: successCopy("LATE", { arriveAtLabel: opts.arriveAtLabel, delayMinutes: 0 }) };
    }
    claim.lateMinutes = lateBy;
    claim.lateAt = new Date();
    await claim.save();
    await notifyUser({
      recipientId: String(donation.donorId),
      type: "PICKUP_RUNNING_LATE",
      title: "Pickup running late",
      message: lateDonorMessage(org, lateBy, claim.quantity),
      donationId: String(donation._id),
      claimId: String(claim._id),
    });
    return { reply: successCopy("LATE", { delayMinutes: lateBy, arriveAtLabel: opts.arriveAtLabel }) };
  }

  const minutes = opts.delayMinutes;
  if (minutes == null || !Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
    throw new AppError("Specify a delay between 1 and 180 minutes before confirming.");
  }
  claim.lateMinutes = minutes;
  claim.lateAt = new Date();
  await claim.save();

  await notifyUser({
    recipientId: String(donation.donorId),
    type: "PICKUP_RUNNING_LATE",
    title: "Pickup running late",
    message: lateDonorMessage(org, minutes, claim.quantity),
    donationId: String(donation._id),
    claimId: String(claim._id),
  });

  return { reply: successCopy("LATE", { delayMinutes: minutes }) };
}

async function executeUpdateInstructions(opts: {
  userId: string;
  role: string;
  claim: ClaimDoc | null;
  instructions?: string;
}) {
  if (opts.role !== "DONOR") {
    throw new AppError("You cannot update pickup instructions.", 403);
  }
  const claim = opts.claim ? await Claim.findById(opts.claim._id) : null;
  if (!claim || !isOpenStatus(claim.status)) {
    throw new AppError("There isn't an open pickup to send instructions for.", 400);
  }
  const donation = await Donation.findById(claim.donationId);
  if (!donation || String(donation.donorId) !== opts.userId) {
    throw new AppError("You cannot update pickup instructions.", 403);
  }
  const instructions = sanitizeInstructions(opts.instructions || "");
  if (!instructions) throw new AppError("Add a short pickup instruction first.");

  donation.pickupInstructions = instructions;
  await donation.save();

  await notifyUser({
    recipientId: String(claim.recipientId),
    type: "PICKUP_INSTRUCTIONS_UPDATED",
    title: "Pickup instructions updated",
    message: instructionsRecipientMessage(instructions),
    donationId: String(donation._id),
    claimId: String(claim._id),
  });

  return { reply: successCopy("UPDATE_INSTRUCTIONS", {}) };
}

async function executeArrived(opts: {
  userId: string;
  role: string;
  claim: ClaimDoc | null;
}) {
  const claim = opts.claim ? await Claim.findById(opts.claim._id) : null;
  if (!claim || !isOpenStatus(claim.status)) {
    throw new AppError("You don't have an open pickup to announce arrival for.", 400);
  }
  const donation = await Donation.findById(claim.donationId);
  if (!donation) throw new AppError("Donation not found.", 404);

  const isRecipient = opts.role === "RECIPIENT" && String(claim.recipientId) === opts.userId;
  const isDonor = opts.role === "DONOR" && String(donation.donorId) === opts.userId;
  if (!isRecipient && !isDonor) {
    throw new AppError("You cannot send this arrival update.", 403);
  }

  const actor = await User.findById(opts.userId);
  const actorLabel = actor?.organizationName || actor?.name || (isDonor ? "The donor" : "The recipient");
  const otherId = isRecipient ? String(donation.donorId) : String(claim.recipientId);

  await notifyUser({
    recipientId: otherId,
    type: "PICKUP_ARRIVED",
    title: "Pickup arrival",
    message: arrivedOtherMessage(actorLabel, claim.quantity),
    donationId: String(donation._id),
    claimId: String(claim._id),
  });

  return { reply: successCopy("ARRIVED", {}) };
}

async function executeRelay(opts: {
  userId: string;
  role: string;
  claim: ClaimDoc | null;
  relayMessage?: string;
}) {
  if (opts.role !== "RECIPIENT" && opts.role !== "DONOR") {
    throw new AppError("Only donors and recipients can send pickup messages.", 403);
  }
  const claim = opts.claim ? await Claim.findById(opts.claim._id) : null;
  if (!claim || !isOpenStatus(claim.status)) {
    throw new AppError("There isn't an open pickup to send a message for.", 400);
  }
  const donation = await Donation.findById(claim.donationId);
  if (!donation) throw new AppError("Donation not found.", 404);

  const isRecipient = opts.role === "RECIPIENT" && String(claim.recipientId) === opts.userId;
  const isDonor = opts.role === "DONOR" && String(donation.donorId) === opts.userId;
  if (!isRecipient && !isDonor) {
    throw new AppError("You cannot send this pickup message.", 403);
  }

  const message = sanitizeRelayMessage(opts.relayMessage || "");
  if (!message) throw new AppError("Add a short pickup message first.");

  const actor = await User.findById(opts.userId);
  const org = actor?.organizationName || actor?.name || (isDonor ? "The donor" : "The recipient");
  const otherId = isRecipient ? String(donation.donorId) : String(claim.recipientId);

  await notifyUser({
    recipientId: otherId,
    type: "PICKUP_MESSAGE",
    title: "Pickup message",
    message: relayOtherMessage(org, message, claim.quantity),
    donationId: String(donation._id),
    claimId: String(claim._id),
  });

  return { reply: successCopy("RELAY", { relayTo: isRecipient ? "donor" : "recipient" }) };
}
