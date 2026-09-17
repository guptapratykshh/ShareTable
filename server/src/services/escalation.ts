import { escalationThresholdsMs, radiusForLevel } from "../config.js";
import { Donation } from "../models/Donation.js";
import type { DonationDoc } from "../models/Donation.js";
import { Notification } from "../models/Notification.js";
import type { DonationStatus } from "../types.js";
import { AppError, kmLabel } from "../utils.js";
import { findNearbyRecipients } from "./geo.js";

const CLAIMABLE: DonationStatus[] = ["ACTIVE", "PARTIALLY_CLAIMED"];

export function targetEscalationLevel(createdAt: Date, now = Date.now()): 1 | 2 | 3 {
  const age = now - createdAt.getTime();
  const [t2, t3] = escalationThresholdsMs();
  if (age >= t3) return 3;
  if (age >= t2) return 2;
  return 1;
}

function alreadyNotified(donation: DonationDoc, recipientId: string) {
  return (donation.notifiedRecipients ?? []).some((n) => String(n.recipientId) === recipientId);
}

async function notifyNewRecipients(donation: DonationDoc, level: number) {
  const nearby = await findNearbyRecipients(donation.location, donation.currentRadiusKm);
  const fresh = nearby.filter((r) => !alreadyNotified(donation, r.id));
  if (!fresh.length) return [];

  const minutesLeft = Math.max(0, Math.round((donation.expiresAt.getTime() - Date.now()) / 60_000));
  const urgent = level >= 3;
  await Notification.insertMany(
    fresh.map((r) => ({
      recipientId: r.id,
      type: urgent ? "URGENT_RESCUE" : "RESCUE_EXPANDED",
      title: urgent ? "Urgent rescue" : "ShareTable alert",
      message: urgent
        ? `This food donation is approaching expiration.\n${donation.availableQuantity} meals remain.\nPickup required within ${minutesLeft} minutes.\nRescue radius: ${donation.currentRadiusKm} km.`
        : `This donation has not been fully claimed.\n${donation.availableQuantity} meals remain available.\nRescue radius has expanded to ${donation.currentRadiusKm} km.\n${minutesLeft} minutes remaining.\nDistance: ${kmLabel(r.distanceKm)}`,
      donationId: donation._id,
    })),
  );

  const now = new Date();
  for (const r of fresh) {
    donation.notifiedRecipients.push({
      recipientId: r.id as never,
      level,
      notifiedAt: now,
    });
  }
  donation.notifiedRecipientCount = donation.notifiedRecipients.length;
  return fresh;
}

export async function escalateDonationIfNeeded(
  donation: DonationDoc,
  opts?: { forceLevel?: 1 | 2 | 3 },
): Promise<DonationDoc> {
  if (!CLAIMABLE.includes(donation.status) || donation.availableQuantity <= 0) return donation;
  if (donation.expiresAt.getTime() <= Date.now()) return donation;

  const current = (donation.escalationLevel ?? 1) as 1 | 2 | 3;
  const target = opts?.forceLevel ?? targetEscalationLevel(donation.createdAt);
  if (target <= current) return donation;

  donation.escalationLevel = target;
  donation.currentRadiusKm = radiusForLevel(target);
  donation.lastEscalatedAt = new Date();
  await notifyNewRecipients(donation, target);
  await donation.save();
  return donation;
}

export async function escalateClaimableDonations(): Promise<void> {
  const rows = await Donation.find({
    status: { $in: CLAIMABLE },
    availableQuantity: { $gt: 0 },
    expiresAt: { $gt: new Date() },
  });
  for (const row of rows) {
    await escalateDonationIfNeeded(row);
  }
}

export async function forceNextEscalation(donation: DonationDoc): Promise<DonationDoc> {
  if (!CLAIMABLE.includes(donation.status) || donation.availableQuantity <= 0) {
    throw new AppError("This donation cannot escalate.");
  }
  if (donation.expiresAt.getTime() <= Date.now()) {
    throw new AppError("Donation has expired.");
  }
  const current = donation.escalationLevel ?? 1;
  if (current >= 3) throw new AppError("Already at the maximum rescue radius.");
  return escalateDonationIfNeeded(donation, { forceLevel: (current + 1) as 2 | 3 });
}

export function rescueStatusPayload(donation: DonationDoc) {
  return {
    id: String(donation._id),
    status: donation.status,
    escalationLevel: donation.escalationLevel ?? 1,
    currentRadiusKm: donation.currentRadiusKm ?? 2.5,
    availableQuantity: donation.availableQuantity,
    quantity: donation.quantity,
    expiresAt: donation.expiresAt,
    lastEscalatedAt: donation.lastEscalatedAt,
    notifiedRecipientCount: donation.notifiedRecipientCount,
  };
}
