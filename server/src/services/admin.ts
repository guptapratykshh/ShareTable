import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Claim } from "../models/Claim.js";
import type { ClaimDoc } from "../models/Claim.js";
import { Donation } from "../models/Donation.js";
import type { DonationDoc } from "../models/Donation.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import type { DonorType, RecipientType, Role } from "../types.js";
import { AppError, point } from "../utils.js";
import { claimMeals, completePickup, maybeCompleteDonation } from "./claims.js";
import { applyDonationEdits, createDonationListing, type DonationWriteInput } from "./listings.js";
import { recipientReliability, reliabilityMap } from "./reliability.js";
import { publicUser, serializeClaim, serializeDonation } from "./serialize.js";

function requireObjectId(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new AppError("Not found.", 404);
  return id;
}

export function serializeAdminDonation(donation: DonationDoc, viewerId: string) {
  return serializeDonation(donation, {
    role: "ADMIN",
    userId: viewerId,
    exactLocation: true,
    hasClaim: true,
  });
}

export function serializeAdminClaim(
  claim: ClaimDoc,
  extra?: {
    donation?: ReturnType<typeof serializeDonation>;
    recipient?: { id: string; name: string; organizationName?: string; reliabilityScore?: number | null };
    revealCode?: boolean;
  },
) {
  return serializeClaim(claim, {
    donation: extra?.donation,
    recipient: extra?.recipient,
    revealCode: extra?.revealCode ?? false,
  });
}

export async function listAdminUsers(role?: string) {
  const filter: { role: Role } | { role: { $in: Role[] } } =
    role === "DONOR" || role === "RECIPIENT" ? { role } : { role: { $in: ["DONOR", "RECIPIENT"] } };
  const users = await User.find(filter).sort({ createdAt: -1 });
  const donorIds = users.filter((u) => u.role === "DONOR").map((u) => u._id);
  const recipientIds = users.filter((u) => u.role === "RECIPIENT").map((u) => u._id);
  const donations = await Donation.find({ donorId: { $in: donorIds } }).select("donorId createdAt");
  const claims = await Claim.find({ recipientId: { $in: recipientIds } }).select("recipientId");
  const scores = await reliabilityMap(recipientIds.map((id) => String(id)));

  const listingCount = new Map<string, number>();
  const lastPosted = new Map<string, Date>();
  for (const d of donations) {
    const id = String(d.donorId);
    listingCount.set(id, (listingCount.get(id) ?? 0) + 1);
    const prev = lastPosted.get(id);
    if (!prev || d.createdAt > prev) lastPosted.set(id, d.createdAt);
  }
  const claimCount = new Map<string, number>();
  for (const c of claims) {
    const id = String(c.recipientId);
    claimCount.set(id, (claimCount.get(id) ?? 0) + 1);
  }

  return users.map((user) => ({
    ...publicUser(user),
    listingsCount: user.role === "DONOR" ? (listingCount.get(user.id) ?? 0) : undefined,
    lastPostedAt: user.role === "DONOR" ? lastPosted.get(user.id) : undefined,
    claimsCount: user.role === "RECIPIENT" ? (claimCount.get(user.id) ?? 0) : undefined,
    reliabilityScore: user.role === "RECIPIENT" ? (scores[user.id]?.score ?? null) : undefined,
  }));
}

export async function getAdminUser(id: string, viewerId: string) {
  const user = await User.findById(requireObjectId(id));
  if (!user || user.role === "ADMIN") throw new AppError("User not found.", 404);

  const donations = await Donation.find({ donorId: user._id }).sort({ createdAt: -1 });
  const claims = await Claim.find(
    user.role === "RECIPIENT"
      ? { recipientId: user._id }
      : { donationId: { $in: donations.map((d) => d._id) } },
  ).sort({ claimedAt: -1 });
  const claimDonations =
    user.role === "RECIPIENT"
      ? await Donation.find({ _id: { $in: claims.map((c) => c.donationId) } })
      : donations;
  const recipients = await User.find({ _id: { $in: claims.map((c) => c.recipientId) } });
  const reliability = user.role === "RECIPIENT" ? await recipientReliability(user.id) : undefined;

  return {
    user: {
      ...publicUser(user),
      listingsCount: user.role === "DONOR" ? donations.length : undefined,
      lastPostedAt: user.role === "DONOR" ? donations[0]?.createdAt : undefined,
      claimsCount: user.role === "RECIPIENT" ? claims.length : undefined,
      reliabilityScore: reliability?.score ?? undefined,
    },
    reliability,
    donations: donations.map((d) => serializeAdminDonation(d, viewerId)),
    claims: claims.map((c) => {
      const donation = claimDonations.find((d) => d.id === String(c.donationId));
      const recipient = recipients.find((u) => u.id === String(c.recipientId));
      return serializeAdminClaim(c, {
        donation: donation ? serializeAdminDonation(donation, viewerId) : undefined,
        recipient: recipient
          ? { id: recipient.id, name: recipient.name, organizationName: recipient.organizationName }
          : undefined,
        revealCode: false,
      });
    }),
  };
}

export type AdminUserWrite = {
  name: string;
  email: string;
  phone: string;
  password?: string;
  role: "DONOR" | "RECIPIENT";
  organizationName?: string;
  address: string;
  location: { lat: number; lng: number };
  donorType?: DonorType;
  recipientType?: RecipientType;
};

export async function createAdminUser(data: AdminUserWrite) {
  if (data.role === "DONOR" && !data.donorType) throw new AppError("Select a donor type.");
  if (data.role === "RECIPIENT" && !data.recipientType) throw new AppError("Select a recipient type.");
  if (!data.password) throw new AppError("Password is required.");

  const existing = await User.findOne({ email: data.email.toLowerCase() });
  if (existing) throw new AppError("An account with this email already exists.", 409);

  const isNgo = data.role === "RECIPIENT" && data.recipientType === "NGO";
  const user = await User.create({
    name: data.name,
    email: data.email.toLowerCase(),
    phone: data.phone,
    passwordHash: await bcrypt.hash(data.password, 10),
    role: data.role,
    organizationName: data.organizationName,
    donorType: data.role === "DONOR" ? data.donorType : undefined,
    recipientType: data.role === "RECIPIENT" ? data.recipientType : undefined,
    address: data.address,
    location: point(data.location.lng, data.location.lat),
    isVerified: !isNgo,
    emailVerified: true,
  });
  return publicUser(user);
}

export async function replaceAdminUser(id: string, data: AdminUserWrite) {
  const user = await User.findById(requireObjectId(id));
  if (!user || user.role === "ADMIN") throw new AppError("User not found.", 404);
  if (data.role !== user.role) throw new AppError("Cannot change account role.");
  if (data.role === "DONOR" && !data.donorType) throw new AppError("Select a donor type.");
  if (data.role === "RECIPIENT" && !data.recipientType) throw new AppError("Select a recipient type.");

  const email = data.email.toLowerCase();
  if (email !== user.email) {
    const taken = await User.findOne({ email });
    if (taken) throw new AppError("An account with this email already exists.", 409);
  }

  user.name = data.name;
  user.email = email;
  user.phone = data.phone;
  user.organizationName = data.organizationName;
  user.address = data.address;
  user.location = point(data.location.lng, data.location.lat);
  user.donorType = data.role === "DONOR" ? data.donorType : undefined;
  user.recipientType = data.role === "RECIPIENT" ? data.recipientType : undefined;
  if (data.password) user.passwordHash = await bcrypt.hash(data.password, 10);
  await user.save();
  return publicUser(user);
}

export async function deleteAdminUser(id: string) {
  const user = await User.findById(requireObjectId(id));
  if (!user || user.role === "ADMIN") throw new AppError("User not found.", 404);

  if (user.role === "RECIPIENT") {
    const rescued = await Claim.countDocuments({ recipientId: user._id, status: "PICKED_UP" });
    if (rescued > 0) {
      throw new AppError("This account has rescued meals on record, so it cannot be deleted.");
    }
  } else {
    const donationIds = await Donation.find({ donorId: user._id }).select("_id");
    const rescued = await Claim.countDocuments({
      donationId: { $in: donationIds.map((d) => d._id) },
      status: "PICKED_UP",
    });
    if (rescued > 0) {
      throw new AppError("This account has rescued meals on record, so it cannot be deleted.");
    }
  }

  const donationIds = await Donation.find({ donorId: user._id }).select("_id");
  await Claim.deleteMany({
    $or: [{ recipientId: user._id }, { donationId: { $in: donationIds.map((d) => d._id) } }],
  });
  await Donation.deleteMany({ donorId: user._id });
  await Notification.deleteMany({
    $or: [{ recipientId: user._id }, { donationId: { $in: donationIds.map((d) => d._id) } }],
  });
  await user.deleteOne();
  return { ok: true, id: user.id };
}

export async function listAdminDonations(viewerId: string) {
  const donations = await Donation.find().sort({ createdAt: -1 }).limit(300);
  const donors = await User.find({ _id: { $in: donations.map((d) => d.donorId) } });
  return donations.map((d) => {
    const donor = donors.find((u) => u.id === String(d.donorId));
    return {
      ...serializeAdminDonation(d, viewerId),
      donor: donor ? { id: donor.id, name: donor.name, organizationName: donor.organizationName } : undefined,
    };
  });
}

export async function getAdminDonation(id: string, viewerId: string) {
  const donation = await Donation.findById(requireObjectId(id));
  if (!donation) throw new AppError("Donation not found.", 404);
  const donor = await User.findById(donation.donorId);
  const claims = await Claim.find({ donationId: donation._id }).sort({ claimedAt: -1 });
  const recipients = await User.find({ _id: { $in: claims.map((c) => c.recipientId) } });
  return {
    donation: {
      ...serializeAdminDonation(donation, viewerId),
      donor: donor ? { id: donor.id, name: donor.name, organizationName: donor.organizationName } : undefined,
    },
    claims: claims.map((c) => {
      const recipient = recipients.find((u) => u.id === String(c.recipientId));
      return serializeAdminClaim(c, {
        donation: serializeAdminDonation(donation, viewerId),
        recipient: recipient
          ? { id: recipient.id, name: recipient.name, organizationName: recipient.organizationName }
          : undefined,
        revealCode: false,
      });
    }),
  };
}

export async function createAdminDonation(donorId: string, data: DonationWriteInput, viewerId: string) {
  const { donation, nearby } = await createDonationListing(donorId, data);
  return {
    donation: serializeAdminDonation(donation, viewerId),
    notifiedRecipientCount: nearby.length,
  };
}

export async function replaceAdminDonation(
  id: string,
  data: Partial<Omit<DonationWriteInput, "quantity">> & { expiresAt?: string },
  viewerId: string,
) {
  const donation = await Donation.findById(requireObjectId(id));
  if (!donation) throw new AppError("Donation not found.", 404);
  applyDonationEdits(donation, data);
  await donation.save();
  return serializeAdminDonation(donation, viewerId);
}

export async function deleteAdminDonation(id: string) {
  const donation = await Donation.findById(requireObjectId(id));
  if (!donation) throw new AppError("Donation not found.", 404);
  const rescued = await Claim.countDocuments({ donationId: donation._id, status: "PICKED_UP" });
  if (rescued > 0 || donation.status === "COMPLETED") {
    throw new AppError("This listing has recorded pickups, so it stays in history.");
  }
  await Claim.deleteMany({ donationId: donation._id });
  await Notification.deleteMany({ donationId: donation._id });
  await donation.deleteOne();
  return { ok: true, id: donation.id };
}

async function restoreOpenClaim(donation: DonationDoc, quantity: number) {
  if (["EXPIRED", "CANCELLED"].includes(donation.status)) return;
  donation.availableQuantity += quantity;
  if (donation.availableQuantity > donation.quantity) donation.availableQuantity = donation.quantity;
  if (donation.status === "FULLY_CLAIMED" || donation.status === "COMPLETED") {
    donation.status = donation.availableQuantity >= donation.quantity ? "ACTIVE" : "PARTIALLY_CLAIMED";
  } else if (donation.status === "PARTIALLY_CLAIMED" && donation.availableQuantity >= donation.quantity) {
    donation.status = "ACTIVE";
  }
  await donation.save();
}

export async function listAdminClaims(viewerId: string) {
  const claims = await Claim.find().sort({ claimedAt: -1 }).limit(300);
  const donations = await Donation.find({ _id: { $in: claims.map((c) => c.donationId) } });
  const recipients = await User.find({ _id: { $in: claims.map((c) => c.recipientId) } });
  return claims.map((c) => {
    const donation = donations.find((d) => d.id === String(c.donationId));
    const recipient = recipients.find((u) => u.id === String(c.recipientId));
    return serializeAdminClaim(c, {
      donation: donation ? serializeAdminDonation(donation, viewerId) : undefined,
      recipient: recipient
        ? { id: recipient.id, name: recipient.name, organizationName: recipient.organizationName }
        : undefined,
      revealCode: false,
    });
  });
}

export async function getAdminClaim(id: string, viewerId: string) {
  const claim = await Claim.findById(requireObjectId(id));
  if (!claim) throw new AppError("Claim not found.", 404);
  const donation = await Donation.findById(claim.donationId);
  if (!donation) throw new AppError("Donation not found.", 404);
  const recipient = await User.findById(claim.recipientId);
  return serializeAdminClaim(claim, {
    donation: serializeAdminDonation(donation, viewerId),
    recipient: recipient
      ? { id: recipient.id, name: recipient.name, organizationName: recipient.organizationName }
      : undefined,
    revealCode: true,
  });
}

export async function createAdminClaim(opts: { donationId: string; recipientId: string; quantity: number }, viewerId: string) {
  const { claim, donation } = await claimMeals(opts);
  const recipient = await User.findById(claim.recipientId);
  return serializeAdminClaim(claim, {
    donation: serializeAdminDonation(donation, viewerId),
    recipient: recipient
      ? { id: recipient.id, name: recipient.name, organizationName: recipient.organizationName }
      : undefined,
    revealCode: true,
  });
}

export async function replaceAdminClaim(
  id: string,
  data: { quantity?: number; status?: string; claimCode?: string },
  viewerId: string,
) {
  const claim = await Claim.findById(requireObjectId(id));
  if (!claim) throw new AppError("Claim not found.", 404);
  const donation = await Donation.findById(claim.donationId);
  if (!donation) throw new AppError("Donation not found.", 404);

  if (data.status === "PICKED_UP") {
    await completePickup({
      claimId: claim.id,
      actorId: viewerId,
      actorRole: "ADMIN",
      claimCode: data.claimCode,
    });
    return getAdminClaim(claim.id, viewerId);
  }

  if (claim.status === "PICKED_UP") {
    throw new AppError("Picked-up claims cannot be edited because they count as rescued meals.");
  }

  if (data.status === "CANCELLED" || data.status === "NO_SHOW") {
    if (claim.status === "PICKUP_PENDING" || claim.status === "CLAIMED") {
      await restoreOpenClaim(donation, claim.quantity);
    }
    claim.status = data.status;
    await claim.save();
    await maybeCompleteDonation(donation);
    return getAdminClaim(claim.id, viewerId);
  }

  if (data.quantity !== undefined && data.quantity !== claim.quantity) {
    if (!Number.isInteger(data.quantity) || data.quantity < 1) {
      throw new AppError("Claim quantity must be a positive whole number.");
    }
    const delta = data.quantity - claim.quantity;
    if (delta > 0 && donation.availableQuantity < delta) {
      throw new AppError(`Only ${donation.availableQuantity} meals remain on this listing.`);
    }
    if (delta !== 0 && !["EXPIRED", "CANCELLED"].includes(donation.status)) {
      donation.availableQuantity -= delta;
      donation.status = donation.availableQuantity === 0 ? "FULLY_CLAIMED" : "PARTIALLY_CLAIMED";
      if (donation.availableQuantity >= donation.quantity) donation.status = "ACTIVE";
      await donation.save();
    }
    await Claim.collection.updateOne({ _id: claim._id }, { $set: { quantity: data.quantity } });
  }

  return getAdminClaim(claim.id, viewerId);
}

export async function deleteAdminClaim(id: string) {
  const claim = await Claim.findById(requireObjectId(id));
  if (!claim) throw new AppError("Claim not found.", 404);
  if (claim.status === "PICKED_UP") {
    throw new AppError("Picked-up claims cannot be deleted because they count as rescued meals.");
  }
  const donation = await Donation.findById(claim.donationId);
  if (donation && (claim.status === "PICKUP_PENDING" || claim.status === "CLAIMED")) {
    await restoreOpenClaim(donation, claim.quantity);
  }
  await Notification.deleteMany({ claimId: claim._id });
  await claim.deleteOne();
  return { ok: true, id: claim.id };
}
