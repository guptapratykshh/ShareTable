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
  emailVerified?: boolean;
  createdAt: string;
  location?: { lat: number; lng: number };
  listingsCount?: number;
  lastPostedAt?: string;
  claimsCount?: number;
  reliabilityScore?: number | null;
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
  donor?: { id: string; name: string; organizationName?: string };
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

export type PatternSection = { heading: string; body: string };

export type PatternAnalysis = {
  title: string;
  summary: string;
  sections: PatternSection[];
  source: "llm" | "stats";
};

export type DonorPatterns = {
  ready: boolean;
  observed: number;
  minDonations: number;
  weeklyAverage?: number;
  mealsDonated?: number;
  mealsRescued?: number;
  mealsExpired?: number;
  rescueRate?: number;
  averageListingSize?: number;
  analysis?: PatternAnalysis | null;
  insights: { title: string; body: string; explanation?: string; facts: Record<string, string | number> }[];
  byDay: { day: string; meals: number; count: number; average: number }[];
  byTime: { period: string; meals: number; count: number }[];
  byCategory: { category: string; meals: number; share: number }[];
};
