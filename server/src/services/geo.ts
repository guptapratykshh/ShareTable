import { config, maxRescueRadiusKm } from "../config.js";
import { User } from "../models/User.js";
import { Donation } from "../models/Donation.js";
import type { GeoPoint } from "../types.js";
import { haversineKm } from "../utils.js";
import { expireStaleDonations } from "./expiration.js";

export function radiusMeters(km = config.defaultRadiusKm): number {
  return km * 1000;
}

export async function findNearbyRecipients(location: GeoPoint, radiusKm = config.defaultRadiusKm) {
  const recipients = await User.aggregate<{
    _id: unknown;
    name: string;
    organizationName?: string;
    recipientType?: string;
    location: GeoPoint;
    distanceMeters: number;
  }>([
    {
      $geoNear: {
        near: location,
        distanceField: "distanceMeters",
        maxDistance: radiusMeters(radiusKm),
        spherical: true,
        key: "location",
        query: { role: "RECIPIENT" },
      },
    },
    {
      $project: {
        name: 1,
        organizationName: 1,
        recipientType: 1,
        location: 1,
        distanceMeters: 1,
      },
    },
  ]);

  return recipients.map((r) => ({
    id: String(r._id),
    name: r.organizationName || r.name,
    recipientType: r.recipientType,
    distanceKm: r.distanceMeters / 1000,
  }));
}

export async function findNearbyDonations(location: GeoPoint) {
  await expireStaleDonations();
  const { escalateClaimableDonations } = await import("./escalation.js");
  await escalateClaimableDonations();

  const donations = await Donation.aggregate([
    {
      $geoNear: {
        near: location,
        distanceField: "distanceMeters",
        maxDistance: radiusMeters(maxRescueRadiusKm()),
        spherical: true,
        key: "location",
        query: {
          status: { $in: ["ACTIVE", "PARTIALLY_CLAIMED"] },
          expiresAt: { $gt: new Date() },
          availableQuantity: { $gt: 0 },
        },
      },
    },
  ]);

  const eligible = donations.filter((d) => {
    const distanceKm = (d.distanceMeters as number) / 1000;
    const radius = (d.currentRadiusKm as number | undefined) ?? config.defaultRadiusKm;
    return distanceKm <= radius + 0.001;
  });

  // Expiring soon first, then distance. Reliability is never a filter and never hides a recipient.
  eligible.sort((a, b) => {
    const exp = new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
    if (exp !== 0) return exp;
    return (a.distanceMeters as number) - (b.distanceMeters as number);
  });

  return eligible;
}

export function distanceBetween(a: GeoPoint, b: GeoPoint): number {
  return haversineKm(a.coordinates[0], a.coordinates[1], b.coordinates[0], b.coordinates[1]);
}

export function isWithinRadius(a: GeoPoint, b: GeoPoint, radiusKm = config.defaultRadiusKm): boolean {
  return distanceBetween(a, b) <= radiusKm + 0.001;
}
