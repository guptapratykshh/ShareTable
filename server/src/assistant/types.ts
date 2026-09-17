export const ASSISTANT_INTENTS = [
  "FAQ",
  "QUERY_STATS",
  "QUERY_PICKUP",
  "LATE",
  "UPDATE_INSTRUCTIONS",
  "ARRIVED",
  "UNKNOWN",
] as const;

export type AssistantIntent = (typeof ASSISTANT_INTENTS)[number];

export type ActionKind = "LATE" | "UPDATE_INSTRUCTIONS" | "ARRIVED";

export type ClassifiedIntent = {
  intent: AssistantIntent;
  delayMinutes?: number;
  instructions?: string;
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
  createdAt: number;
  expiresAt: number;
  consumed: boolean;
  result?: { reply: string };
};

export type AssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type OpenPickupFact = {
  claimId: string;
  donationId: string;
  foodName: string;
  quantity: number;
  address?: string;
  pickupDeadline: string;
  pickupInstructions?: string;
  recipientName?: string;
  allergens?: string[];
};

export type AssistantFacts = {
  role: string;
  displayName: string;
  mealsPickedUp?: number;
  mealsRescued?: number;
  activeClaims?: number;
  activeDonations?: number;
  openPickups: OpenPickupFact[];
};
