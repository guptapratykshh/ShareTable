export const ROLES = ["DONOR", "RECIPIENT", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const DONOR_TYPES = [
  "College Mess",
  "Restaurant",
  "Catering",
  "Event Organizer",
  "Household",
  "Other",
] as const;
export type DonorType = (typeof DONOR_TYPES)[number];

export const RECIPIENT_TYPES = [
  "NGO",
  "Community Organization",
  "Individual Recipient",
] as const;
export type RecipientType = (typeof RECIPIENT_TYPES)[number];

export const FOOD_CATEGORIES = [
  "Indian",
  "Rice/Grains",
  "Bread/Bakery",
  "Vegetarian",
  "Non-Vegetarian",
  "Snacks",
  "Dessert",
  "Other",
] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const DONATION_STATUSES = [
  "ACTIVE",
  "PARTIALLY_CLAIMED",
  "FULLY_CLAIMED",
  "EXPIRED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type DonationStatus = (typeof DONATION_STATUSES)[number];

export const CLAIM_STATUSES = [
  "CLAIMED",
  "PICKUP_PENDING",
  "PICKED_UP",
  "CANCELLED",
  "NO_SHOW",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "NEW_DONATION",
  "DONATION_CLAIMED",
  "CLAIM_CONFIRMED",
  "PICKUP_REMINDER",
  "DONATION_EXPIRED",
  "DONATION_COMPLETED",
  "RESCUE_EXPANDED",
  "URGENT_RESCUE",
] as const;

export type UrgencyBand = "NORMAL" | "EXPANDED" | "CRITICAL";
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type GeoPoint = {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
};
