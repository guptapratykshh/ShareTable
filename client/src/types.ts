export type Role = "DONOR" | "RECIPIENT" | "ADMIN";

export type User = {
  id: string;
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
  createdAt: string;
  location?: { lat: number; lng: number };
};

export type Donation = {
  id: string;
  foodName: string;
  description: string;
  category: string;
  quantity: number;
  availableQuantity: number;
  preparedAt?: string;
  bestBefore?: string;
  storageCondition?: string;
  createdAt: string;
  expiresAt: string;
  status: string;
  imageUrl?: string;
  notifiedRecipientCount?: number;
  donorId: string;
  distanceKm?: number;
  address?: string;
  pickupInstructions?: string;
  allergens?: string[];
  location?: { lat: number; lng: number };
  escalationLevel?: number;
  currentRadiusKm?: number;
  urgencyBand?: "NORMAL" | "EXPANDED" | "CRITICAL";
  urgencyLabel?: string;
};

export type Claim = {
  id: string;
  donationId: string;
  recipientId: string;
  quantity: number;
  status: string;
  claimCode?: string;
  claimedAt: string;
  pickupDeadline: string;
  completedAt?: string;
  donation?: Donation;
  recipient?: { id: string; name: string; organizationName?: string; reliabilityScore?: number | null };
  pickedUpAt?: string;
  pickupDurationMinutes?: number;
  lateMinutes?: number;
  lateNote?: string;
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  donationId?: string;
  claimId?: string;
  isRead: boolean;
  createdAt: string;
};

export const DONOR_TYPES = [
  "College Mess",
  "Restaurant",
  "Catering",
  "Event Organizer",
  "Household",
  "Other",
] as const;

export type PublicImpact = {
  mealsRescued: number;
  mealsRescuedThisWeek: number;
  totalDonors: number;
  totalNgos: number;
  defaultRadiusKm: number;
  listingWindowHours: number;
};

export const RECIPIENT_TYPES = [
  "NGO",
  "Community Organization",
  "Individual Recipient",
] as const;

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

export const COMMON_ALLERGENS = [
  "Peanuts",
  "Tree nuts",
  "Milk",
  "Eggs",
  "Wheat / gluten",
  "Soy",
  "Fish",
  "Shellfish",
  "Sesame",
  "Mustard",
  "Sulphites",
] as const;
