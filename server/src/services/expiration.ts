import { Donation } from "../models/Donation.js";
import type { DonationDoc } from "../models/Donation.js";
import type { DonationStatus } from "../types.js";

const CLAIMABLE: DonationStatus[] = ["ACTIVE", "PARTIALLY_CLAIMED"];

export function shouldExpire(donation: Pick<DonationDoc, "status" | "expiresAt" | "availableQuantity">): boolean {
  return (
    CLAIMABLE.includes(donation.status) &&
    donation.availableQuantity > 0 &&
    donation.expiresAt.getTime() <= Date.now()
  );
}

export async function expireDonationIfNeeded(donation: DonationDoc): Promise<DonationDoc> {
  if (!shouldExpire(donation)) return donation;
  donation.status = "EXPIRED";
  await donation.save();
  return donation;
}

export async function expireStaleDonations(): Promise<number> {
  const result = await Donation.updateMany(
    {
      status: { $in: CLAIMABLE },
      availableQuantity: { $gt: 0 },
      expiresAt: { $lte: new Date() },
    },
    { $set: { status: "EXPIRED" } },
  );
  return result.modifiedCount;
}
