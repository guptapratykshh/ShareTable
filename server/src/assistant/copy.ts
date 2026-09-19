import { AppError } from "../utils.js";

const PICKUP_CODE_RE = /\b(?:ST|FR)-\d{4}\b/i;

export function hasPickupCode(text: string) {
  return PICKUP_CODE_RE.test(text);
}

export function stripPickupCodes(text: string) {
  return text.replace(new RegExp(PICKUP_CODE_RE.source, "gi"), "[pickup code omitted]").trim();
}

export const PICKUP_CODE_REFUSE =
  "Pickup codes stay with the recipient at the door. I can't look up, send, or confirm a code in chat.";

export function assertNoPickupCode(text: string) {
  if (PICKUP_CODE_RE.test(text)) {
    throw new AppError("Pickup codes cannot be sent in this notification.");
  }
}

export function sanitizeInstructions(raw: string) {
  let cleaned = stripPickupCodes(raw).replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/\b(send|share|give|provide|pass)\b[\s\S]{0,40}\bpickup code\b[\s\S]{0,30}/gi, " ").trim();
  cleaned = cleaned.replace(/\bpickup code\b[\s\S]{0,20}\b(once|when|after)\s+reached\b/gi, " ").trim();
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  if (
    /^(?:(?:yes|ok|okay|sure)[,.]?\s+)?(?:please\s+)?(?:then\s+)?(?:notify|tell|inform)\s+(him|her|them|the recipient|the picker|the collector|the ngo|the donor|donor)(?:\s+then\s+(?:notify|tell|inform)\s+(him|her|them|the recipient|the picker|the collector|the ngo|the donor|donor))?(?:\s+please)?[.!?]?$/i.test(
      cleaned,
    )
  ) {
    return "";
  }
  if (/^no[,.]?\s+/i.test(cleaned)) {
    cleaned = cleaned.replace(/^no[,.]?\s+/i, "").trim();
  }
  return cleaned.slice(0, 500);
}

export function sanitizeRelayMessage(raw: string) {
  let cleaned = stripPickupCodes(raw).replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/\b(send|share|give|provide|pass)\b[\s\S]{0,40}\bpickup code\b[\s\S]{0,30}/gi, " ").trim();
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  if (
    /^(?:(?:yes|ok|okay|sure)[,.]?\s+)?(?:please\s+)?(?:then\s+)?(?:notify|tell|inform)\s+(him|her|them|the recipient|the picker|the collector|the ngo|the donor|donor)(?:\s+then\s+(?:notify|tell|inform)\s+(him|her|them|the recipient|the picker|the collector|the ngo|the donor|donor))?(?:\s+please)?[.!?]?$/i.test(
      cleaned,
    )
  ) {
    return "";
  }

  // Strip leading tell/ask/notify the donor/recipient phrases
  cleaned = cleaned
    .replace(
      /^(?:can you |could you |please )?(?:tell|ask|notify|inform|message|text|ping)\s+(?:the\s+)?(?:donor|recipient|picker|collector|ngo|him|her|them)\s+(?:to |that |about )?/i,
      "",
    )
    .trim();
  if (/^no[,.]?\s+/i.test(cleaned)) {
    cleaned = cleaned.replace(/^no[,.]?\s+/i, "").trim();
  }
  return cleaned.slice(0, 500);
}

export function confirmationCopy(
  kind: "LATE" | "UPDATE_INSTRUCTIONS" | "ARRIVED" | "RELAY",
  opts: {
    delayMinutes?: number;
    instructions?: string;
    arriveAtLabel?: string;
    relayMessage?: string;
    relayTo?: "donor" | "recipient";
  },
) {
  if (kind === "LATE") {
    if (opts.arriveAtLabel && (opts.delayMinutes == null || opts.delayMinutes <= 0)) {
      return `I'll tell the donor you'll arrive around ${opts.arriveAtLabel}. Send this update?`;
    }
    if (opts.arriveAtLabel && opts.delayMinutes && opts.delayMinutes > 0) {
      return `I'll notify the donor that you'll arrive around ${opts.arriveAtLabel} (about ${opts.delayMinutes} minutes after the pickup window). Send this update?`;
    }
    const n = opts.delayMinutes ?? 10;
    return `I'll notify the donor that you'll arrive approximately ${n} minutes late. Send this update?`;
  }
  if (kind === "UPDATE_INSTRUCTIONS") {
    return `I'll tell the recipient: "${opts.instructions ?? ""}". Pickup codes stay with the recipient at the door. Send this update?`;
  }
  if (kind === "RELAY") {
    const who = opts.relayTo === "recipient" ? "recipient" : "donor";
    return `I'll tell the ${who}: "${opts.relayMessage ?? ""}". Send this update?`;
  }
  return "I'll notify the other participant that you've arrived. Send this update?";
}

export function successCopy(
  kind: "LATE" | "UPDATE_INSTRUCTIONS" | "ARRIVED" | "RELAY",
  opts: { delayMinutes?: number; arriveAtLabel?: string; relayTo?: "donor" | "recipient" },
) {
  if (kind === "LATE") {
    if (opts.arriveAtLabel && (opts.delayMinutes == null || opts.delayMinutes <= 0)) {
      return `Sent. The donor has been notified that you'll arrive around ${opts.arriveAtLabel}.`;
    }
    return `Sent. The donor has been notified that you'll arrive about ${opts.delayMinutes ?? 10} minutes late.`;
  }
  if (kind === "UPDATE_INSTRUCTIONS") {
    return "Sent. The recipient has been notified of the new pickup instructions.";
  }
  if (kind === "RELAY") {
    const who = opts.relayTo === "recipient" ? "recipient" : "donor";
    return `Sent. The ${who} has been notified.`;
  }
  return "Sent. The other participant has been notified that you've arrived.";
}

export function lateDonorMessage(org: string, minutes: number, quantity: number) {
  const meals = `${quantity}-meal`;
  const text = `${org} expects to arrive about ${minutes} minutes late for the ${meals} pickup.`;
  assertNoPickupCode(text);
  return text;
}

export function arriveAtDonorMessage(org: string, arriveAtLabel: string, quantity: number) {
  const meals = `${quantity}-meal`;
  const text = `${org} expects to arrive around ${arriveAtLabel} for the ${meals} pickup.`;
  assertNoPickupCode(text);
  return text;
}

export function instructionsRecipientMessage(instructions: string) {
  const body = stripPickupCodes(instructions).replace(/[.!?]+$/, "");
  const text = `Pickup instructions updated: ${body}.`;
  assertNoPickupCode(text);
  return text;
}

export function arrivedOtherMessage(actorLabel: string, quantity: number) {
  const text = `${actorLabel} has arrived for the ${quantity}-meal pickup.`;
  assertNoPickupCode(text);
  return text;
}

export function relayOtherMessage(org: string, relayMessage: string, quantity: number) {
  const meals = `${quantity}-meal`;
  const body = stripPickupCodes(relayMessage).replace(/[.!?]+$/, "");
  const text = body.startsWith("is ")
    ? `${org} ${body} for the ${meals} pickup.`
    : `${org}: ${body} (for the ${meals} pickup).`;
  assertNoPickupCode(text);
  return text;
}
