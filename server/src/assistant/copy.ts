import { AppError } from "../utils.js";

const PICKUP_CODE_RE = /\b(?:ST|FR)-\d{4}\b/i;

export function stripPickupCodes(text: string) {
  return text.replace(PICKUP_CODE_RE, "[pickup code omitted]").trim();
}

export function assertNoPickupCode(text: string) {
  if (PICKUP_CODE_RE.test(text)) {
    throw new AppError("Pickup codes cannot be sent in this notification.");
  }
}

export function sanitizeInstructions(raw: string) {
  const cleaned = stripPickupCodes(raw).replace(/\s+/g, " ").trim();
  if (/security guard/i.test(cleaned)) {
    return "Food has been kept near the security guard.";
  }
  return cleaned.slice(0, 200);
}

export function confirmationCopy(kind: "LATE" | "UPDATE_INSTRUCTIONS" | "ARRIVED", opts: {
  delayMinutes?: number;
  instructions?: string;
}) {
  if (kind === "LATE") {
    const n = opts.delayMinutes ?? 10;
    return `I'll notify the donor that you'll arrive approximately ${n} minutes late. Send this update?`;
  }
  if (kind === "UPDATE_INSTRUCTIONS") {
    return `I'll tell the recipient: "${opts.instructions ?? ""}". Send this update?`;
  }
  return "I'll notify the other participant that you've arrived. Send this update?";
}

export function successCopy(kind: "LATE" | "UPDATE_INSTRUCTIONS" | "ARRIVED", opts: { delayMinutes?: number }) {
  if (kind === "LATE") {
    return `Sent. The donor has been notified that you'll arrive about ${opts.delayMinutes ?? 10} minutes late.`;
  }
  if (kind === "UPDATE_INSTRUCTIONS") {
    return "Sent. The recipient has been notified of the new pickup instructions.";
  }
  return "Sent. The other participant has been notified that you've arrived.";
}

export function lateDonorMessage(org: string, minutes: number, quantity: number) {
  const meals = `${quantity}-meal`;
  const text = `${org} expects to arrive about ${minutes} minutes late for the ${meals} pickup.`;
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
