import { matchKnowledge, UNKNOWN_FACT_REPLY } from "./knowledge.js";
import { confirmationCopy, sanitizeInstructions } from "./copy.js";
import { loadAssistantFacts } from "./facts.js";
import { classifyAssistantMessage, maybeRephraseFaq } from "./classify.js";
import { createPendingAction } from "./pending.js";
import { resolveOwnedOpenClaim } from "./actions.js";
import type { AssistantChatMessage, AssistantFacts, ClassifiedIntent } from "./types.js";

export type AssistantTurn = {
  reply: string;
  pendingActionId?: string;
  factsUsed: string[];
};

function formatDeadline(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function statsReply(facts: AssistantFacts) {
  if (facts.role === "RECIPIENT") {
    return `You've picked up ${facts.mealsPickedUp ?? 0} meals. You have ${facts.activeClaims ?? 0} open pickup${(facts.activeClaims ?? 0) === 1 ? "" : "s"}. Rescued totals only include recorded pickups.`;
  }
  if (facts.role === "DONOR") {
    return `You've rescued ${facts.mealsRescued ?? 0} meals. Rescued is counted only after pickup is recorded as PICKED_UP.`;
  }
  return "I can look up your own pickups and donations after you sign in as a donor or recipient.";
}

function pickupReply(facts: AssistantFacts) {
  const pickup = facts.openPickups[0];
  if (!pickup) return "You don't have an open pickup right now.";
  if (facts.role === "RECIPIENT") {
    const where = pickup.address ? ` at ${pickup.address}` : "";
    return `${pickup.quantity} meals of ${pickup.foodName} are reserved. Pickup before ${formatDeadline(pickup.pickupDeadline)}${where}.`;
  }
  const who = pickup.recipientName ? ` ${pickup.recipientName}` : " a recipient";
  return `${pickup.quantity} meals of ${pickup.foodName} are waiting for${who}. Pickup before ${formatDeadline(pickup.pickupDeadline)}.`;
}

export function isAllergenQuestion(message: string) {
  return /\b(allergen|allergens|allergies|allergic|peanuts?|allergen list|in my order)\b/.test(message.toLowerCase());
}

function mentionedAllergen(message: string, declared: string[]) {
  const text = message.toLowerCase();
  for (const item of declared) {
    if (item && text.includes(item.toLowerCase())) return item;
  }
  const peanut = text.match(/\bpeanuts?\b/);
  return peanut ? "Peanuts" : undefined;
}

function allergenReply(facts: AssistantFacts, message: string) {
  const pickup = facts.openPickups[0];
  if (!pickup) {
    return matchKnowledge(message)?.answer ?? matchKnowledge("allergen list")?.answer ?? UNKNOWN_FACT_REPLY;
  }
  const declared = pickup.allergens ?? [];
  const asked = mentionedAllergen(message, declared);
  const disclaimer = "This is donor-declared, not a lab test or medical guarantee.";
  if (!declared.length) {
    const named = asked ?? "peanuts or other allergens";
    return `The donor did not declare allergens on ${pickup.foodName}. That is not a guarantee it is free of ${named}. Ask the donor at pickup. ${disclaimer}`;
  }
  if (asked && declared.some((item) => item.toLowerCase() === asked.toLowerCase())) {
    return `The donor declared ${asked} on ${pickup.foodName}. ${disclaimer}`;
  }
  if (asked) {
    return `The donor declared: ${declared.join(", ")}. ${asked} is not on that list. That does not guarantee the food is free of ${asked}. ${disclaimer}`;
  }
  return `The donor declared these allergens on ${pickup.foodName}: ${declared.join(", ")}. ${disclaimer}`;
}

async function proposeAction(opts: {
  userId: string;
  role: string;
  classified: ClassifiedIntent;
}): Promise<AssistantTurn> {
  const { classified, userId, role } = opts;
  const kind = classified.intent as "LATE" | "UPDATE_INSTRUCTIONS" | "ARRIVED";

  if (kind === "LATE" && role !== "RECIPIENT") {
    return { reply: "Only the recipient on an open pickup can send a late update.", factsUsed: ["role"] };
  }
  if (kind === "UPDATE_INSTRUCTIONS" && role !== "DONOR") {
    return { reply: "Only the donor can update pickup instructions.", factsUsed: ["role"] };
  }

  const claim = await resolveOwnedOpenClaim({
    userId,
    role,
    hintClaimId: classified.claimId,
    hintDonationId: classified.donationId,
  });

  if (!claim) {
    const empty =
      kind === "UPDATE_INSTRUCTIONS"
        ? "There isn't an open pickup to send instructions for."
        : kind === "LATE"
          ? "You don't have an open pickup to mark late."
          : "You don't have an open pickup to announce arrival for.";
    return { reply: empty, factsUsed: ["openPickups"] };
  }

  const delayMinutes = kind === "LATE" ? classified.delayMinutes ?? 10 : undefined;
  const instructions = kind === "UPDATE_INSTRUCTIONS" ? sanitizeInstructions(classified.instructions || "") : undefined;
  if (kind === "UPDATE_INSTRUCTIONS" && !instructions) {
    return { reply: "Tell me the pickup instruction you want the recipient to see.", factsUsed: ["openPickups"] };
  }

  const pending = createPendingAction({
    userId,
    kind,
    claimId: String(claim._id),
    donationId: String(claim.donationId),
    delayMinutes,
    instructions,
  });

  return {
    reply: confirmationCopy(kind, { delayMinutes, instructions }),
    pendingActionId: pending.id,
    factsUsed: ["openPickups"],
  };
}

export async function handleAssistantMessage(opts: {
  userId: string;
  role: string;
  message: string;
  history?: AssistantChatMessage[];
}): Promise<AssistantTurn> {
  const facts = await loadAssistantFacts(opts.userId, opts.role);
  const classified = await classifyAssistantMessage({
    message: opts.message,
    history: opts.history ?? [],
    facts,
  });

  if (isAllergenQuestion(opts.message)) {
    if (facts.openPickups[0]) {
      return { reply: allergenReply(facts, opts.message), factsUsed: ["allergens"] };
    }
    const entry = matchKnowledge(opts.message) ?? matchKnowledge("allergen list");
    const reply = entry ? await maybeRephraseFaq(entry.answer, opts.message) : UNKNOWN_FACT_REPLY;
    return { reply, factsUsed: [entry?.id ?? "diet"] };
  }

  if (classified.intent === "FAQ") {
    const entry = matchKnowledge(opts.message);
    if (!entry) {
      return { reply: UNKNOWN_FACT_REPLY, factsUsed: ["knowledge"] };
    }
    const reply = await maybeRephraseFaq(entry.answer, opts.message);
    return { reply, factsUsed: [entry.id] };
  }

  if (classified.intent === "QUERY_STATS") {
    return { reply: statsReply(facts), factsUsed: facts.role === "DONOR" ? ["mealsRescued"] : ["mealsPickedUp"] };
  }

  if (classified.intent === "QUERY_PICKUP") {
    return { reply: pickupReply(facts), factsUsed: ["openPickups"] };
  }

  if (classified.intent === "LATE" || classified.intent === "UPDATE_INSTRUCTIONS" || classified.intent === "ARRIVED") {
    return proposeAction({ userId: opts.userId, role: opts.role, classified });
  }

  return {
    reply:
      "I can explain ShareTable pickup rules, check your open pickup, or send a late / instructions / arrived update after you confirm it.",
    factsUsed: ["role"],
  };
}
