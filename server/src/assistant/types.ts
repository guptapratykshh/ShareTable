export const ASSISTANT_INTENTS = [
  "FAQ",
  "QUERY_STATS",
  "QUERY_PICKUP",
  "QUERY_NEARBY",
  "LATE",
  "UPDATE_INSTRUCTIONS",
  "ARRIVED",
  "RELAY",
  "UNKNOWN",
] as const;

export type AssistantIntent = (typeof ASSISTANT_INTENTS)[number];

export type ActionKind = "LATE" | "UPDATE_INSTRUCTIONS" | "ARRIVED" | "RELAY";

export type ClassifiedIntent = {
  intent: AssistantIntent;
  delayMinutes?: number;
  instructions?: string;
  relayMessage?: string;
  arriveAtLabel?: string;
  arriveAtMinutes?: number;
  claimId?: string;
  donationId?: string;
};

export type PendingActionRecord = {
  id: string;
  userId: string;
  kind: ActionKind;
  claimId?: string;
  donationId?: string;
  delayMinutes?: number;
  instructions?: string;
  relayMessage?: string;
  arriveAtLabel?: string;
  arriveAtMinutes?: number;
  createdAt: number;
  expiresAt: number;
  consumed: boolean;
  result?: { reply: string };
};

export type AssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type PickupFact = {
  claimId: string;
  donationId: string;
  foodName: string;
  category?: string;
  quantity: number;
  address?: string;
  pickupDeadline: string;
  pickupInstructions?: string;
  recipientName?: string;
  donorName?: string;
  status?: string;
  allergens?: string[];
};

export type OpenPickupFact = PickupFact;

export type NearbyListingFact = {
  foodName: string;
  quantity: number;
  distanceKm: number;
};

export type LastNotificationFact = {
  type: string;
  title: string;
  sentTo: string;
  at: string;
};

export type AssistantFacts = {
  role: string;
  displayName: string;
  mealsPickedUp?: number;
  mealsRescued?: number;
  activeClaims?: number;
  activeDonations?: number;
  openPickups: PickupFact[];
  recentPickups?: PickupFact[];
  lastNotifications?: LastNotificationFact[];
  nearbyListings?: NearbyListingFact[];
  nearbyCount?: number;
  nearbyRadiusKm?: number;
};
