import { matchKnowledge, UNKNOWN_FACT_REPLY } from "./knowledge.js";
import { confirmationCopy, PICKUP_CODE_REFUSE, sanitizeInstructions, sanitizeRelayMessage } from "./copy.js";
import { loadAssistantFacts } from "./facts.js";
import { classifyAssistantMessage, groundedReply } from "./classify.js";
import { cancelPendingAction, clearClarification, confirmPendingAction, createPendingAction, getClarification, getOpenPendingForUser, isPendingInFlight, setClarification } from "./pending.js";
import { choosePickup, classifiedFromPending, isActionIntent, pickupChoices } from "./dialogue.js";
import { executePendingAction, resolveOwnedOpenClaim } from "./actions.js";
import {
  isAllergenQuestion,
  isBareNotifyRequest,
  isCorrection,
  isNonActionStatement,
  normalizeChatText,
  parseDelayMinutes,
  isChatCancelPhrase,
  isChatConfirmPhrase,
  isDietQuestion,
  isLocationQuestion,
  isNotifyStatusQuestion,
  isPickupCodeQuestion,
} from "./detect.js";
import type { AssistantChatMessage, AssistantFacts, ClassifiedIntent, PickupFact } from "./types.js";

export type AssistantTurn = {
  reply: string;
  pendingActionId?: string;
  factsUsed: string[];
};

const UNKNOWN_REFUSE =
  "I can only help with ShareTable pickups and listings. Are you asking about your pickup, reporting a delay, or asking me to pass on a pickup message? Tell me the message and I'll show you a preview before sending.";

function formatDeadline(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function currentPickup(facts: AssistantFacts): PickupFact | undefined {
  return facts.openPickups[0] ?? facts.recentPickups?.[0];
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

function pickupReply(facts: AssistantFacts, message: string) {
  const open = facts.openPickups[0];
  const pickup = currentPickup(facts);
  if (!pickup) return "You don't have an open pickup right now.";
  const where = pickup.address ? ` at ${pickup.address}` : "";
  if (isLocationQuestion(message) && pickup.address) {
    const when = open ? ` Pickup before ${formatDeadline(pickup.pickupDeadline)}.` : "";
    return `Pickup is at ${pickup.address} for ${pickup.foodName}.${when}`;
  }
  if (open) {
    if (facts.role === "RECIPIENT") {
      return `${pickup.quantity} meals of ${pickup.foodName} are reserved. Pickup before ${formatDeadline(pickup.pickupDeadline)}${where}.`;
    }
    const who = pickup.recipientName ? ` ${pickup.recipientName}` : " a recipient";
    return `${pickup.quantity} meals of ${pickup.foodName} are waiting for${who}. Pickup before ${formatDeadline(pickup.pickupDeadline)}${where}.`;
  }
  if (facts.role === "RECIPIENT") {
    return `Your last pickup was ${pickup.quantity} meals of ${pickup.foodName}${where}.`;
  }
  const who = pickup.recipientName ? ` ${pickup.recipientName}` : " a recipient";
  return `The last pickup was ${pickup.quantity} meals of ${pickup.foodName} for${who}${where}.`;
}

function nearbyReply(facts: AssistantFacts) {
  if (facts.role !== "RECIPIENT") {
    const n = facts.activeDonations ?? 0;
    return `You have ${n} active donation${n === 1 ? "" : "s"}. Nearby listing search is for recipients.`;
  }
  const listings = facts.nearbyListings ?? [];
  const count = facts.nearbyCount ?? listings.length;
  if (!count) return "There are no claimable donations in your current pickup radius.";
  const closest = listings
    .slice(0, 3)
    .map((l) => `${l.foodName} (${l.quantity} meals, ${l.distanceKm} km)`)
    .join("; ");
  return `There ${count === 1 ? "is" : "are"} ${count} claimable donation${count === 1 ? "" : "s"} nearby. Closest: ${closest}.`;
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
  const pickup = currentPickup(facts);
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

function dietReply(facts: AssistantFacts) {
  const pickup = currentPickup(facts);
  const disclaimer = "This is the donor-declared listing category, not a lab test or ingredient check.";
  if (!pickup?.category) {
    return matchKnowledge("vegetarian")?.answer ?? UNKNOWN_FACT_REPLY;
  }
  if (pickup.category === "Vegetarian" || pickup.category === "Non-Vegetarian") {
    return `The listing category for ${pickup.foodName} is ${pickup.category}. ${disclaimer}`;
  }
  return `The listing category for ${pickup.foodName} is ${pickup.category}. That does not confirm vegetarian vs non-vegetarian. Check the listing or ask the donor at pickup. ${disclaimer}`;
}

function notifyStatusReply(facts: AssistantFacts, message: string) {
  const notes = facts.lastNotifications ?? [];
  if (!notes.length) {
    return "I haven't sent a pickup notification for this listing yet. Confirm a late, instructions, or arrived update to send one.";
  }
  const text = message.toLowerCase();
  const named = notes.find((n) => n.sentTo && text.includes(n.sentTo.toLowerCase()));
  const last = named ?? notes[0];
  return `The last notification was "${last.title}" to ${last.sentTo}.`;
}

async function proposeAction(opts: {
  userId: string;
  role: string;
  classified: ClassifiedIntent;
  facts: AssistantFacts;
  message: string;
}): Promise<AssistantTurn> {
  const { classified, userId, role, facts, message } = opts;
  const kind = classified.intent as "LATE" | "UPDATE_INSTRUCTIONS" | "ARRIVED" | "RELAY";

  if (kind === "LATE" && role !== "RECIPIENT") {
    return { reply: "Only the recipient on an open pickup can send a late update.", factsUsed: ["role"] };
  }
  if (kind === "UPDATE_INSTRUCTIONS" && role !== "DONOR") {
    return {
      reply: "Only the donor can update pickup instructions. If you need the donor, tell me the short message to send and confirm it.",
      factsUsed: ["role"],
    };
  }
  if (kind === "RELAY" && role !== "DONOR" && role !== "RECIPIENT") {
    return { reply: "Only donors and recipients can send pickup messages.", factsUsed: ["role"] };
  }

  const candidates = classified.claimId
    ? facts.openPickups.filter(p => p.claimId === classified.claimId)
    : classified.donationId
      ? facts.openPickups.filter(p => p.donationId === classified.donationId)
      : facts.openPickups;
  const selected = choosePickup(message, candidates) ?? (candidates.length === 1 ? candidates[0] : undefined);
  if (!selected && candidates.length > 1) {
    setClarification(userId, { classified, question: "pickup", message, claimIds: candidates.map(p => p.claimId) });
    return { reply: `Which pickup is this update for? Reply with its number or food name.\n${pickupChoices(candidates)}`, factsUsed: ["openPickups"] };
  }
  if (!selected) {
    clearClarification(userId);
    return { reply: "I couldn't find that open pickup in your account. Check your pickup details before asking me to send an update.", factsUsed: ["openPickups"] };
  }
  classified.claimId = selected.claimId;
  classified.donationId = selected.donationId;
  if (kind === "LATE" && classified.delayMinutes == null && !classified.arriveAtLabel) {
    setClarification(userId, { classified, question: "delay", message });
    return { reply: "How many minutes late do you expect to be? Give one estimate from 1 to 180 minutes, such as ‘20 minutes’. Nothing has been sent.", factsUsed: ["openPickups"] };
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
          : kind === "RELAY"
            ? "There isn't an open pickup to send a message for."
            : "You don't have an open pickup to announce arrival for.";
    return { reply: empty, factsUsed: ["openPickups"] };
  }

  let delayMinutes = kind === "LATE" ? classified.delayMinutes : undefined;
  const arriveAtLabel = kind === "LATE" ? classified.arriveAtLabel : undefined;
  const arriveAtMinutes = kind === "LATE" ? classified.arriveAtMinutes : undefined;
  if (kind === "LATE" && arriveAtLabel && arriveAtMinutes != null && delayMinutes == null) {
    const arrive = new Date(claim.pickupDeadline);
    arrive.setHours(Math.floor(arriveAtMinutes / 60), arriveAtMinutes % 60, 0, 0);
    const diffMs = arrive.getTime() - claim.pickupDeadline.getTime();
    delayMinutes = diffMs <= 0 ? 0 : Math.min(180, Math.max(1, Math.ceil(diffMs / 60_000)));
  }


  const instructions = kind === "UPDATE_INSTRUCTIONS" ? sanitizeInstructions(classified.instructions || "") : undefined;
  if (kind === "UPDATE_INSTRUCTIONS" && !instructions) {
    return { reply: "Tell me the pickup instruction you want the recipient to see.", factsUsed: ["openPickups"] };
  }

  const relayMessage = kind === "RELAY" ? sanitizeRelayMessage(classified.relayMessage || "") : undefined;
  if (kind === "RELAY" && !relayMessage) {
    setClarification(userId, { classified, question: "message", message });
    return {
      reply: "Tell me the short pickup message you want the other party to see, then confirm it.",
      factsUsed: ["openPickups"],
    };
  }

  const pending = createPendingAction({
    userId,
    kind,
    claimId: String(claim._id),
    donationId: String(claim.donationId),
    delayMinutes,
    instructions,
    relayMessage,
    arriveAtLabel,
    arriveAtMinutes,
  });

  const relayTo = kind === "RELAY" ? (role === "DONOR" ? "recipient" : "donor") : undefined;

  return {
    reply: `For ${selected.foodName}: ${confirmationCopy(kind, { delayMinutes, instructions, arriveAtLabel, relayMessage, relayTo })}`,
    pendingActionId: pending.id,
    factsUsed: ["openPickups"],
  };
}

async function fallbackQuestionTurn(opts: {
  message: string;
  facts: AssistantFacts;
  classified: ClassifiedIntent;
}): Promise<AssistantTurn> {
  const { message, facts, classified } = opts;

  if (isPickupCodeQuestion(message)) {
    return { reply: PICKUP_CODE_REFUSE, factsUsed: ["pickupCode"] };
  }

  if (isAllergenQuestion(message)) {
    if (currentPickup(facts)) {
      return { reply: allergenReply(facts, message), factsUsed: ["allergens"] };
    }
    const entry = matchKnowledge(message) ?? matchKnowledge("allergen list");
    return { reply: entry?.answer ?? UNKNOWN_FACT_REPLY, factsUsed: [entry?.id ?? "diet"] };
  }

  if (isDietQuestion(message)) {
    return { reply: dietReply(facts), factsUsed: ["diet"] };
  }

  if (isNotifyStatusQuestion(message)) {
    return { reply: notifyStatusReply(facts, message), factsUsed: ["lastNotifications"] };
  }

  if (classified.intent === "FAQ") {
    const entry = matchKnowledge(message);
    if (!entry) {
      return { reply: UNKNOWN_FACT_REPLY, factsUsed: ["knowledge"] };
    }
    return { reply: entry.answer, factsUsed: [entry.id] };
  }

  if (classified.intent === "QUERY_STATS") {
    return { reply: statsReply(facts), factsUsed: facts.role === "DONOR" ? ["mealsRescued"] : ["mealsPickedUp"] };
  }

  if (classified.intent === "QUERY_NEARBY") {
    return { reply: nearbyReply(facts), factsUsed: ["nearbyListings"] };
  }

  if (classified.intent === "QUERY_PICKUP") {
    const pickup = currentPickup(facts);
    return {
      reply: pickupReply(facts, message),
      factsUsed: facts.openPickups[0] ? ["openPickups"] : pickup ? ["recentPickups"] : ["openPickups"],
    };
  }

  return {
    reply: UNKNOWN_REFUSE,
    factsUsed: ["unknown"],
  };
}

export async function handleAssistantMessage(opts: {
  userId: string;
  role: string;
  message: string;
  history?: AssistantChatMessage[];
  pendingActionId?: string | null;
}): Promise<AssistantTurn> {
  const message = normalizeChatText(opts.message);
  const history = opts.history ?? [];
  const openPending = getOpenPendingForUser(opts.userId);
  const draft = getClarification(opts.userId);
  // The browser binds chat replies to the preview it actually displayed. Older API clients
  // can omit the id and use the current user-scoped proposal.
  const mismatchedPreview = opts.pendingActionId !== undefined && opts.pendingActionId !== (openPending?.id ?? null);
  if (isChatCancelPhrase(message)) {
    if (mismatchedPreview) return { reply: "That preview is no longer current. Please describe the update again.", factsUsed: ["pendingAction"] };
    if (openPending) cancelPendingAction(openPending.id, opts.userId);
    clearClarification(opts.userId);
    return { reply: openPending || draft ? "Cancelled. Nothing was sent." : "There is no pending update to cancel.", factsUsed: ["pendingAction"] };
  }
  if (isChatConfirmPhrase(message)) {
    if (!openPending && draft && !opts.pendingActionId) {
      const detail = draft.question === "delay" ? "the number of minutes late" : draft.question === "pickup" ? "the pickup number or food name" : "the pickup message you want to send";
      return { reply: `I still need ${detail} before I can show you a preview. Nothing has been sent.`, factsUsed: ["pendingAction"] };
    }
    if (!openPending || mismatchedPreview) {
      return { reply: "There is no matching update ready to send. Please describe the update again so I can show you a new preview.", factsUsed: ["pendingAction"] };
    }
    const result = await confirmPendingAction(openPending.id, opts.userId, pending =>
      executePendingAction({ userId: opts.userId, role: opts.role, pending }),
    );
    return { reply: result.reply, factsUsed: ["pendingAction"] };
  }
  if (openPending && isPendingInFlight(openPending.id)) {
    return { reply: "Your confirmed update is being sent. Please wait before changing it.", factsUsed: ["pendingAction"] };
  }
  if (/\b(?:cancel|delete) (?:my |the |this )?(?:pickup|claim|reservation|donation)\b/.test(message)) {
    if (openPending) cancelPendingAction(openPending.id, opts.userId);
    clearClarification(opts.userId);
    return { reply: "I haven't cancelled your pickup or sent a message. Open the pickup or donation details to cancel it. I can help draft a separate update to the other participant.", factsUsed: ["pendingAction"] };
  }
  if (isPickupCodeQuestion(message)) {
    return { reply: PICKUP_CODE_REFUSE, pendingActionId: openPending?.id, factsUsed: ["pickupCode"] };
  }

  if (isNonActionStatement(message) && /\b(?:not|haven't|didn't|never)\b/.test(message) && /\b(?:arrived|reached|late|at the gate)\b/.test(message)) {
    if (openPending) cancelPendingAction(openPending.id, opts.userId);
    clearClarification(opts.userId);
    return { reply: "Understood. I've cleared any pending update. Tell me what the other participant should know if you'd like a new preview.", factsUsed: ["pendingAction"] };
  }

  const facts = await loadAssistantFacts(opts.userId, opts.role);
  const correction = isCorrection(message) || (openPending?.kind === "LATE" && /^(?:\d+|half|quarter|one|two|five|ten|fifteen|twenty|thirty)\b/.test(message));
  if (openPending && /^(?:what (?:will|would) you (?:send|say)|show (?:me )?(?:the )?(?:message|preview))\??$/.test(message)) {
    return { reply: confirmationCopy(openPending.kind, { ...openPending, relayTo: opts.role === "DONOR" ? "recipient" : "donor" }), pendingActionId: openPending.id, factsUsed: ["pendingAction"] };
  }

  let classified: ClassifiedIntent | undefined;
  if (draft?.question === "pickup" && !isNonActionStatement(message)) {
    const choices = draft.claimIds?.map(id => facts.openPickups.find(p => p.claimId === id)).filter((p): p is PickupFact => Boolean(p)) ?? [];
    // Resolve ordinals against the original order, not a changed list of open pickups.
    const originalChoices = (draft.claimIds ?? []).map(id => facts.openPickups.find(p => p.claimId === id) ?? { claimId: id, foodName: "", donationId: "", quantity: 0, pickupDeadline: "" });
    const selected = choosePickup(message, originalChoices, true);
    if (selected) {
      classified = { ...draft.classified, claimId: selected.claimId, donationId: selected.donationId || undefined };
    } else if (/^(?:the |option |pickup )?(?:\d+|first|second|third|last)(?: one)?[.!]?$/.test(message)) {
      return { reply: `Please choose one of these open pickups:\n${pickupChoices(choices)}`, factsUsed: ["openPickups"] };
    }
  }
  if (draft?.question === "delay" && !isNonActionStatement(message) && !/\b(?:in|within)\b/.test(message) && parseDelayMinutes(message) != null) {
    classified = { ...draft.classified, delayMinutes: parseDelayMinutes(message), arriveAtLabel: undefined, arriveAtMinutes: undefined };
  }
  if (openPending && correction) {
    // A correction immediately retires the old preview, even if the replacement needs clarification.
    cancelPendingAction(openPending.id, opts.userId);
    if (openPending.kind === "LATE" && /\b(?:min|mins|minutes?|hours?|hrs?)\b/.test(message)) {
      classified = { ...classifiedFromPending(openPending), delayMinutes: parseDelayMinutes(message), arriveAtLabel: undefined, arriveAtMinutes: undefined };
    } else if ((openPending.kind === "RELAY" || openPending.kind === "UPDATE_INSTRUCTIONS") && /\b(?:gate|door|entrance|guard|reception|lobby)\b/.test(message)) {
      classified = { ...classifiedFromPending(openPending), relayMessage: sanitizeRelayMessage(opts.message), instructions: sanitizeInstructions(opts.message) };
    }
  }
  if (openPending && isBareNotifyRequest(message)) classified = classifiedFromPending(openPending);
  classified ??= await classifyAssistantMessage({ message, history, facts });
  if (draft?.question === "message" && classified.intent === "UNKNOWN" && !isNonActionStatement(message)) {
    return { reply: "Please include the pickup details in your message, for example ‘Tell the donor I'm waiting at the east gate’.", factsUsed: ["openPickups"] };
  }
  if (isActionIntent(classified)) {
    const remaining = getOpenPendingForUser(opts.userId);
    if (remaining) cancelPendingAction(remaining.id, opts.userId);
    return proposeAction({ userId: opts.userId, role: opts.role, classified, facts, message: classified.claimId ? message : opts.message });
  }
  if (correction && openPending) {
    clearClarification(opts.userId);
    return { reply: "I've removed the previous preview. Please write the full replacement pickup message; I'll ask you to confirm it before sending.", factsUsed: ["pendingAction"] };
  }
  const fallback = await fallbackQuestionTurn({ message, facts, classified });
  if (fallback.factsUsed[0] !== "unknown") return { ...fallback, pendingActionId: getOpenPendingForUser(opts.userId)?.id };
  if (/\b(?:not|haven't|didn't|never)\b/.test(message) && /\b(?:arrived|reached|late)\b/.test(message)) {
    return { reply: "Understood. Tell me if you'd like to send a pickup update, including what the other participant should know.", pendingActionId: getOpenPendingForUser(opts.userId)?.id, factsUsed: ["unknown"] };
  }
  const reply = await groundedReply({ message, history, facts });
  return { ...fallback, reply: reply || fallback.reply, pendingActionId: getOpenPendingForUser(opts.userId)?.id };
}
