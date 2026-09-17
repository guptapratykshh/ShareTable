import type { DonationDoc } from "../models/Donation.js";
import type { ClaimDoc } from "../models/Claim.js";
import { computeUrgency, urgencyLabel } from "./urgency.js";

type Role = "DONOR" | "RECIPIENT" | "ADMIN";

type DonationLike = DonationDoc | {
  _id: unknown;
  id?: string;
  donorId: unknown;
  foodName: string;
  description: string;
  category: string;
  quantity: number;
  availableQuantity: number;
  preparedAt?: Date;
  bestBefore?: Date;
  storageCondition?: string;
  createdAt: Date;
  expiresAt: Date;
  status: string;
  imageUrl?: string;
  notifiedRecipientCount?: number;
  address?: string;
  pickupInstructions?: string;
  allergens?: string[];
  location: { coordinates: [number, number] };
  escalationLevel?: number;
  currentRadiusKm?: number;
  lastEscalatedAt?: Date;
};

function asId(value: unknown): string {
  return String(value);
}

function docId(doc: { id?: string; _id?: unknown }): string {
  return doc.id || asId(doc._id);
}

function snapCoord(n: number) {
  const cell = 0.002;
  return Number((Math.round(n / cell) * cell).toFixed(4));
}

function coords(location: { coordinates: [number, number] }, approximate = false) {
  const lng = location.coordinates[0];
  const lat = location.coordinates[1];
  if (approximate) return { lng: snapCoord(lng), lat: snapCoord(lat) };
  return { lng, lat };
}

export function publicUser(user: {
  _id?: unknown;
  id?: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  organizationName?: string;
  donorType?: string;
  recipientType?: string;
  address: string;
  isVerified: boolean;
  isFlagged?: boolean;
  emailVerified?: boolean;
  createdAt: Date;
  location: { coordinates: [number, number] };
}) {
  return {
    id: docId(user),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    organizationName: user.organizationName,
    donorType: user.donorType,
    recipientType: user.recipientType,
    address: user.address,
    isVerified: user.isVerified,
    isFlagged: user.isFlagged,
    emailVerified: Boolean(user.emailVerified),
    createdAt: user.createdAt,
    location: coords(user.location),
  };
}

export function serializeDonation(
  donation: DonationLike,
  opts: {
    role: Role;
    userId: string;
    distanceKm?: number;
    hasClaim?: boolean;
  },
) {
  const id = docId(donation);
  const donorId = asId(donation.donorId);
  const base = {
    id,
    foodName: donation.foodName,
    description: donation.description,
    category: donation.category,
    quantity: donation.quantity,
    availableQuantity: donation.availableQuantity,
    preparedAt: donation.preparedAt,
    bestBefore: donation.bestBefore,
    storageCondition: donation.storageCondition,
    createdAt: donation.createdAt,
    expiresAt: donation.expiresAt,
    status: donation.status,
    imageUrl: donation.imageUrl,
    notifiedRecipientCount: donation.notifiedRecipientCount ?? 0,
    donorId,
    allergens: Array.isArray(donation.allergens) ? donation.allergens : [],
  };

  const urgency = computeUrgency({
    expiresAt: new Date(donation.expiresAt),
    quantity: donation.quantity,
    availableQuantity: donation.availableQuantity,
    escalationLevel: donation.escalationLevel,
  });
  const isOwner = opts.role === "DONOR" && donorId === opts.userId;
  const isAdmin = opts.role === "ADMIN";
  const revealPickup = isOwner || isAdmin || Boolean(opts.hasClaim);

  return {
    ...base,
    escalationLevel: donation.escalationLevel ?? 1,
    currentRadiusKm: donation.currentRadiusKm ?? 2.5,
    lastEscalatedAt: donation.lastEscalatedAt,
    urgencyBand: urgency.band,
    urgencyLabel: urgencyLabel(urgency.band),
    distanceKm: opts.distanceKm !== undefined ? Number(opts.distanceKm.toFixed(2)) : undefined,
    address: revealPickup ? donation.address : undefined,
    pickupInstructions: revealPickup ? donation.pickupInstructions : undefined,
    location:
      donation.location && (isOwner || Boolean(opts.hasClaim))
        ? coords(donation.location)
        : donation.location && isAdmin
          ? coords(donation.location, true)
          : undefined,
  };
}

export function revealClaimCode(claim: { recipientId: unknown; status: string }, viewerId: string) {
  return String(claim.recipientId) === viewerId || claim.status === "PICKED_UP";
}

export function serializeClaim(
  claim: ClaimDoc,
  extra?: {
    donation?: ReturnType<typeof serializeDonation>;
    recipient?: {
      id: string;
      name: string;
      organizationName?: string;
      reliabilityScore?: number | null;
    };
    viewerId?: string;
    revealCode?: boolean;
  },
) {
  const reveal =
    extra?.revealCode ?? (extra?.viewerId ? revealClaimCode(claim, extra.viewerId) : false);
  return {
    id: docId(claim),
    donationId: String(claim.donationId),
    recipientId: String(claim.recipientId),
    quantity: claim.quantity,
    status: claim.status,
    claimCode: reveal ? claim.claimCode : undefined,
    claimedAt: claim.claimedAt,
    pickupDeadline: claim.pickupDeadline,
    completedAt: claim.completedAt,
    pickedUpAt: claim.pickedUpAt,
    pickupDurationMinutes: claim.pickupDurationMinutes,
    lateMinutes: claim.lateMinutes,
    lateNote: claim.lateNote,
    donation: extra?.donation,
    recipient: extra?.recipient,
  };
}
