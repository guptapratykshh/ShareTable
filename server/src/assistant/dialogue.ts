import { normalizeChatText } from "./detect.js";
import type { ClassifiedIntent, PendingActionRecord, PickupFact } from "./types.js";

export function isActionIntent(classified: ClassifiedIntent) {
  return ["LATE", "UPDATE_INSTRUCTIONS", "ARRIVED", "RELAY"].includes(classified.intent);
}

export function classifiedFromPending(pending: PendingActionRecord): ClassifiedIntent {
  return { ...pending, intent: pending.kind };
}

export function choosePickup(message: string, pickups: PickupFact[], allowOrdinal = false) {
  const text = normalizeChatText(message);
  if (allowOrdinal) {
    const ordinal = text.match(/^(?:(?:the|option|pickup)\s+)?(\d+|first|second|third|fourth|fifth|last)(?:\s+(?:one|pickup))?[.!]?$/);
    if (ordinal) {
      const index = ordinal[1] === "last" ? pickups.length - 1 : ["first", "second", "third", "fourth", "fifth"].indexOf(ordinal[1]);
      return pickups[index >= 0 ? index : Number(ordinal[1]) - 1];
    }
  }
  const exact = pickups.filter(p => text.includes(p.claimId));
  if (exact.length === 1) return exact[0];
  const named = pickups.filter(p => [p.foodName, p.recipientName, p.donorName].some(name => {
    if (!name) return false;
    const normalized = normalizeChatText(name);
    if (text.includes(normalized)) return true;
    // Only use distinctive food-name words; party names must match in full.
    return name === p.foodName && normalized.split(/\W+/).some(word => word.length >= 4 && !["food", "meal", "meals", "with"].includes(word) && text.split(/\W+/).includes(word));
  }));
  return named.length === 1 ? named[0] : undefined;
}

export function pickupChoices(pickups: PickupFact[]) {
  return pickups.map((p, i) => `${i + 1}. ${p.foodName} — ${p.recipientName || p.donorName || "pickup"}, ${p.quantity} meals`).join("\n");
}
