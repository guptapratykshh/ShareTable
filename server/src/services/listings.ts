import { config } from "../config.js";
import { Donation } from "../models/Donation.js";
import type { DonationDoc } from "../models/Donation.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import type { FoodCategory } from "../types.js";
import { AppError, kmLabel, normalizeAllergens, point } from "../utils.js";
import { findNearbyRecipients } from "./geo.js";

export type DonationWriteInput = {
  foodName: string;
  description: string;
  quantity: number;
  category: FoodCategory;
  preparedAt?: string;
  bestBefore?: string;
  storageCondition?: string;
  address: string;
  pickupInstructions?: string;
  allergens?: string[];
  imageUrl?: string;
  location: { lat: number; lng: number };
};

export async function createDonationListing(donorId: string, data: DonationWriteInput) {
  const donor = await User.findById(donorId);
  if (!donor || donor.role !== "DONOR") {
    throw new AppError("Choose a kitchen (donor) for this listing.", 400);
  }

  const location = point(data.location.lng, data.location.lat);
  const nearby = await findNearbyRecipients(location, config.rescueRadiusLevels[0] ?? config.defaultRadiusKm);
  const now = new Date();
  const notifiedAt = now;
  const level1 = 1;

  const donation = await Donation.create({
    donorId: donor._id,
    foodName: data.foodName,
    description: data.description,
    category: data.category,
    quantity: data.quantity,
    availableQuantity: data.quantity,
    preparedAt: data.preparedAt ? new Date(data.preparedAt) : undefined,
    bestBefore: data.bestBefore ? new Date(data.bestBefore) : undefined,
    storageCondition: data.storageCondition,
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    location,
    address: data.address,
    pickupInstructions: data.pickupInstructions,
    allergens: normalizeAllergens(data.allergens),
    imageUrl: data.imageUrl || undefined,
    status: "ACTIVE",
    safetyConfirmed: true,
    notifiedRecipientCount: nearby.length,
    escalationLevel: 1,
    currentRadiusKm: config.rescueRadiusLevels[0] ?? config.defaultRadiusKm,
    lastEscalatedAt: now,
    notifiedRecipients: nearby.map((r) => ({
      recipientId: r.id,
      level: level1,
      notifiedAt,
    })),
  });

  if (nearby.length) {
    await Notification.insertMany(
      nearby.map((r) => ({
        recipientId: r.id,
        type: "NEW_DONATION",
        title: "New food donation nearby",
        message: `${data.quantity} meals available\nFood: ${data.foodName}\nDistance: ${kmLabel(r.distanceKm)}\nPickup: available for the next 1 hour`,
        donationId: donation._id,
      })),
    );
  }

  return { donation, nearby };
}

export function applyDonationEdits(
  donation: DonationDoc,
  data: Partial<Omit<DonationWriteInput, "quantity">> & { expiresAt?: string },
) {
  if (data.foodName !== undefined) donation.foodName = data.foodName;
  if (data.description !== undefined) donation.description = data.description;
  if (data.category !== undefined) donation.category = data.category;
  if (data.preparedAt !== undefined) donation.preparedAt = data.preparedAt ? new Date(data.preparedAt) : undefined;
  if (data.bestBefore !== undefined) donation.bestBefore = data.bestBefore ? new Date(data.bestBefore) : undefined;
  if (data.storageCondition !== undefined) donation.storageCondition = data.storageCondition;
  if (data.address !== undefined) donation.address = data.address;
  if (data.pickupInstructions !== undefined) donation.pickupInstructions = data.pickupInstructions;
  if (data.allergens !== undefined) donation.allergens = normalizeAllergens(data.allergens);
  if (data.imageUrl !== undefined) donation.imageUrl = data.imageUrl || undefined;
  if (data.location) donation.location = point(data.location.lng, data.location.lat);
  if (data.expiresAt) donation.expiresAt = new Date(data.expiresAt);
  return donation;
}
