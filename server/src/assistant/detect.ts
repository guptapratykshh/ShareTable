import type { AssistantChatMessage } from "./types.js";
import { hasPickupCode, sanitizeInstructions, sanitizeRelayMessage } from "./copy.js";

/** Normalize common typing variants for detection, never fuzzy-match permission to send. */
export function normalizeChatText(message: string) {
  return message.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim()
    .replace(/\b(?:pls|plz)\b/g, "please")
    .replace(/\b(?:arived|arrivd)\b/g, "arrived")
    .replace(/\b(?:reachd|reched)\b/g, "reached")
    .replace(/\b(?:waitng|wating)\b/g, "waiting")
    .replace(/\bdont\b/g, "don't")
    .replace(/\bcant\b/g, "can't")
    .replace(/\bim\b/g, "i'm")
    .replace(/\bive\b/g, "i've");
}

export function isNonActionStatement(message: string) {
  const text = normalizeChatText(message);
  // Explicit relay requests can report a negative fact without claiming arrival.
  if (isTellDonor(text) || isTellRecipient(text)) return false;
  return /^(?:(?:he|she|they|the (?:donor|recipient))\b|what (?:if|happens)|how (?:do|can|should)|(?:am|are|is|has|have|did|when|where)\b|if\b|when i\b)/.test(text) ||
    /\b(?:not|never|haven't|hasn't|hadn't|didn't|don't|won't|can't|cannot)\s+(?:yet\s+|be\s+|been\s+|have\s+)?(?:arriv\w*|reach\w*|here|outside|at the|late|delayed)\b/.test(text) ||
    /\b(?:will|would|might|may|should|'ll)\b.{0,20}\b(?:arrived|reached)\b/.test(text);
}

export function parseDelayMinutes(message: string): number | undefined {
  let text = normalizeChatText(message);
  const words: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
    sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  };
  if (/\b(?:hundred|thousand)\b|[-−]\s*\d/.test(text)) return undefined;
  text = text.replace(/\bhalf (?:an? )?hour\b/g, "30 minutes")
    .replace(/\bquarter (?:of an? )?hour\b/g, "15 minutes")
    .replace(/\b(?:a|an) hour\b/g, "1 hour")
    .replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[- ]+(one|two|three|four|five|six|seven|eight|nine)\b/g, (_, tens: string, unit: string) => String(words[tens] + words[unit]))
    .replace(new RegExp(`\\b(${Object.keys(words).join("|")})\\b`, "g"), word => String(words[word]));
  if (/\d+\s+\d+/.test(text)) return undefined;
  const matches = [...text.matchAll(/(?<![\d.-])(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)\b/g)];
  // Ranges and multiple estimates need clarification rather than an arbitrary choice.
  if (matches.length !== 1 || /\d+\s*(?:-|to|or|and)\s*\d+/.test(text)) return undefined;
  const minutes = Number(matches[0][1]) * (/^(?:h)/.test(matches[0][2]) ? 60 : 1);
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 180 ? minutes : undefined;
}

export function isLateStatement(message: string) {
  const text = normalizeChatText(message);
  return !isNonActionStatement(text) && /\b(late|running behind|delay|delayed|stuck in traffic)\b/.test(text);
}

const RECIPIENT_PARTY =
  "him|her|them|the recipient|the picker|the collector|the ngo|recipient|picker|collector|ngo";
const DONOR_PARTY = "him|her|them|the donor|donor|the mess|mess|the cafeteria|cafeteria|the college|college";

export function isAllergenQuestion(message: string) {
  return /\b(allergen|allergens|allergies|allergic|peanuts?|allergen list|in my order)\b/.test(normalizeChatText(message));
}

export function isDietQuestion(message: string) {
  const text = normalizeChatText(message);
  if (isAllergenQuestion(message) && !/\b(veg|vegetarian|non[-\s]?veg)\b/.test(text)) return false;
  return /\b(non[-\s]?veg(?:etarian)?|vegetarian|\bveg\b|meat|chicken|dietary|food category)\b/.test(text);
}

export function isLocationQuestion(message: string) {
  const text = normalizeChatText(message);
  if (/\bpickup code\b/.test(text)) return false;
  return (
    /\b(where (?:was|is|were)(?: the)? pickup|location of(?: the)? pickup|what was the location|pickup address|pickup point|where do i (?:go|collect|pick)|my pickup|open pickup)\b/.test(
      text,
    ) ||
    (/\b(where|location|address)\b/.test(text) && /\bpickup\b/.test(text))
  );
}

export function isNearbyQuestion(message: string) {
  const text = normalizeChatText(message);
  return (
    /\b(in my area|near me|nearby listing|listings nearby|donations (?:nearby|in my area|around me)|around me|in the area|active donations)\b/.test(
      text,
    ) ||
    (/\bnearby\b/.test(text) && /\b(donation|listing|food|meal)\b/.test(text))
  );
}

export function isNotifyStatusQuestion(message: string) {
  return /\b(have you (?:notified|sent)|did you (?:notify|send|tell)|was .+ notified|notified .+ yet|has .+ been (?:notified|sent))\b/.test(normalizeChatText(message));
}

export function asksToSendPickupCode(message: string) {
  const text = normalizeChatText(message);
  return (
    hasPickupCode(message) ||
    /\b(send|share|give|provide|pass)\b[\s\S]{0,40}\bpickup code\b/.test(text) ||
    /\bpickup code\b[\s\S]{0,20}\b(once|when|after)\b/.test(text) ||
    /\bmy pickup code is\b/.test(text)
  );
}

export function isTellDonor(message: string) {
  const text = normalizeChatText(message);
  return new RegExp(`(?:(?:tell|ask|notify|inform|message|text|ping)\\s+(?:the\\s+)?(${DONOR_PARTY})\\b|let\\s+(?:${DONOR_PARTY})\\s+know)`, "i").test(text);
}

export function isTellRecipient(message: string) {
  const text = normalizeChatText(message);
  return new RegExp(`(?:(?:tell|ask|notify|inform|message|text|ping)\\s+(?:the\\s+)?(${RECIPIENT_PARTY})\\b|let\\s+(?:${RECIPIENT_PARTY})\\s+know)`, "i").test(text);
}

export function hasInstructionContent(message: string) {
  const text = normalizeChatText(message);
  if (
    /security guard|pickup instructions|kept near|left (it |the food )?at|i've kept|ive kept|update instructions/.test(
      text,
    )
  ) {
    return true;
  }
  if (/\b(with|near|at)\s+(the\s+)?(security\s+)?guard\b/.test(text)) return true;
  if (/\bguard\b/.test(text) && /\b(keep|keeping|kept|leave|left|donation|food|meal|packet)\b/.test(text)) {
    return true;
  }
  if (/\b(keeping|kept)\b.{0,50}\b(donation|food|meal|it)\b/.test(text)) return true;
  if (/collect .{0,60}from the (?:security )?guard/.test(text)) return true;
  if (/\b(?:use|enter|collect|pick up)\b.{0,50}\b(?:gate|entrance|reception|desk|lobby|door)\b/.test(text)) return true;
  return false;
}

/** Only an unqualified approval can execute an existing proposal. */
export function isChatConfirmPhrase(message: string) {
  const text = normalizeChatText(message).replace(/[.!]+$/, "");
  return /^(?:(?:yes|ok|okay|sure|yep|yeah)[,]?\s+)?(?:please\s+)?(?:then\s+)?(?:yes|ok|okay|sure|yep|yeah|send(?:\s+it|\s+this|\s+the\s+(?:notification|update|message))?|confirm(?:\s+it)?|do\s+it|go\s+ahead)(?:\s+please)?$/.test(text) ||
    /^(?:yes|ok|okay|sure),? please$/.test(text);
}

export function isChatCancelPhrase(message: string) {
  const text = normalizeChatText(message).replace(/[.!]+$/, "");
  return /^(?:no|nah|nope|stop|wait|hold on|not yet|never\s*mind|forget it)$/.test(text) ||
    /^(?:(?:no|nah|nope)[,]?\s+)?(?:please\s+)?(?:cancel(?:\s+(?:it|that|the (?:message|update|notification)))?|never\s*mind|(?:don't|do not)(?:\s+send(?:\s+(?:it|that|the (?:message|update|notification)))?)(?:\s+yet)?)(?:\s+please)?$/.test(text);
}

export function isCorrection(message: string) {
  return /^(?:actually|instead|no[, ]|i mean|change\b|make (?:it|that)\b|correction\b|yes[, ]+but\b)/.test(normalizeChatText(message));
}

/** Follow-ups that should reuse the last real instruction or relay from history. */
export function isBareNotifyRequest(message: string) {
  const text = normalizeChatText(message);
  if (isNotifyStatusQuestion(text)) return false;
  if (isChatConfirmPhrase(text)) return true;
  if (/\b(keeping|kept|guard|left|collect|gate|location|waiting)\b/.test(text) && !/^(yes|ok|okay|sure)\b/.test(text)) {
    if (/\b(keeping|kept|guard|gate|location|waiting)\b/.test(text)) return false;
  }
  return /^(?:(?:yes|ok|okay|sure)[,.]?\s+)?(?:please\s+)?(?:then\s+)?(?:notify|tell|inform)\s+(him|her|them|the recipient|the picker|the collector|the ngo|the donor|donor)(?:\s+then\s+(?:notify|tell|inform)\s+(him|her|them|the recipient|the picker|the collector|the ngo|the donor|donor))?(?:\s+please)?[.!?]?$/i.test(
    text,
  );
}

export function isInstructionUpdate(message: string) {
  if (isNotifyStatusQuestion(message)) return false;
  if (isBareNotifyRequest(message) || isChatConfirmPhrase(message) || isChatCancelPhrase(message)) return false;
  if (isTellDonor(message) && !hasInstructionContent(message)) return false;
  if (hasInstructionContent(message)) return true;
  if (isTellRecipient(message) && hasInstructionContent(message)) return true;
  // Soft ask/tell without guard/keep content is a RELAY, not pickup-instruction change
  if (isTellRecipient(message) && !hasInstructionContent(message)) return false;
  return false;
}

export function isWaitingAtPickup(message: string) {
  const text = normalizeChatText(message);
  if (isNonActionStatement(text)) return false;
  return /\b(?:i(?:'m| am)|we(?:'re| are)) (?:already )?(?:at|outside|near|waiting)\b/.test(text) ||
    /\b(?:i(?:'ve| have)?|we(?:'ve| have)?) (?:already )?(?:reached|arrived)\b/.test(text) ||
    /\b(?:waiting (?:at|here|outside)|no one (?:is )?(?:here|there)|nobody (?:is )?(?:here|there)|(?:can't|cannot) (?:find|see) (?:anyone|you|the donor|them))\b/.test(text);
}

export function isPureArrival(message: string) {
  const text = normalizeChatText(message);
  if (isNonActionStatement(text) || isTellDonor(text) || isTellRecipient(text)) return false;
  if (/\b(?:come|open|unlock|help|can't|cannot|no one|nobody)\b/.test(text)) return false;
  return /\b(?:i(?:'ve| have|'m| am)?|we(?:'ve| have|'re| are)?) (?:already )?(?:arrived|reached|here|at (?:the )?(?:[\w-]+ )?(?:gate|door|entrance|location)|outside)\b/.test(text) ||
    /^(?:arrived|reached(?: the (?:location|gate|pickup))?|here now|at the door|outside)[.!]*$/.test(text);
}

export function isRelayRequest(message: string, role: string) {
  const text = normalizeChatText(message);
  if (isNotifyStatusQuestion(text) || isChatConfirmPhrase(text) || isChatCancelPhrase(text)) return false;
  if (isBareNotifyRequest(text)) return true;
  if (role === "DONOR") return isTellRecipient(text) && !hasInstructionContent(text);
  if (role !== "RECIPIENT") return false;
  if (isTellDonor(text)) return true;
  if (isNonActionStatement(text)) return false;
  if (isWaitingAtPickup(text) && /\b(?:come|open|unlock|help|can't|cannot|no one|nobody)\b/.test(text)) return true;
  return /\b(?:please )?(?:come|open|unlock)\b.{0,40}\b(?:gate|door|entrance|pickup)\b/.test(text) ||
    /\b(?:gate|door|entrance) (?:is )?(?:locked|closed|blocked)\b/.test(text);
}

export function isPickupCodeQuestion(message: string) {
  if (!asksToSendPickupCode(message)) return false;
  if ((isInstructionUpdate(message) || isRelayRequest(message, "DONOR") || isRelayRequest(message, "RECIPIENT")) && !isBareNotifyRequest(message)) {
    return false;
  }
  return !/\b(late|running behind|delay|delayed|arrived|i'm here|im here|at the door)\b/.test(normalizeChatText(message));
}

export type ParsedArriveAt = {
  label: string;
  minutesFromMidnight: number;
};

export function parseArriveAt(message: string): ParsedArriveAt | null {
  const text = normalizeChatText(message);
  if (
    /\b(i'm here|im here|at the door|outside|we've arrived|we have arrived|i have arrived|i(?:'ve| have) reached|reached(?:\s+the)?\s+(?:location|gate|door))\b/.test(
      text,
    )
  ) {
    return null;
  }
  if (!/\b(reach(?:ing)?|arriv(?:e|ing)|be there|getting there|will be)\b/.test(text)) {
    return null;
  }
  const match = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  if (!Number.isFinite(hour) || hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  const meridiem = match[3].replace(/\./g, "").toLowerCase();
  if (meridiem.startsWith("p") && hour < 12) hour += 12;
  if (meridiem.startsWith("a") && hour === 12) hour = 0;
  const label = `${Number(match[1])}:${String(minute).padStart(2, "0")} ${meridiem.startsWith("p") ? "pm" : "am"}`;
  return { label, minutesFromMidnight: hour * 60 + minute };
}

export function isEtaArrival(message: string) {
  return Boolean(parseArriveAt(message));
}

export function lastUserInstruction(history: AssistantChatMessage[]) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const line = history[i];
    if (line.role !== "user") continue;
    if (isChatCancelPhrase(line.content) || isChatConfirmPhrase(line.content)) break;
    if (isBareNotifyRequest(line.content) || isNotifyStatusQuestion(line.content)) continue;
    if (!isInstructionUpdate(line.content) && !hasInstructionContent(line.content)) {
      if (isRelayRequest(line.content, "DONOR") || isRelayRequest(line.content, "RECIPIENT")) break;
      continue;
    }
    const cleaned = sanitizeInstructions(line.content);
    if (cleaned) return cleaned;
  }
  return "";
}

export function lastUserRelay(history: AssistantChatMessage[]) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const line = history[i];
    if (line.role !== "user") continue;
    if (isChatCancelPhrase(line.content) || isChatConfirmPhrase(line.content)) break;
    if (isBareNotifyRequest(line.content) || isNotifyStatusQuestion(line.content)) continue;
    if (!isRelayRequest(line.content, "RECIPIENT") && !isRelayRequest(line.content, "DONOR") && !isWaitingAtPickup(line.content) && !isTellDonor(line.content)) {
      continue;
    }
    if (isInstructionUpdate(line.content) && hasInstructionContent(line.content)) continue;
    const cleaned = sanitizeRelayMessage(line.content);
    if (cleaned) return cleaned;
  }
  return "";
}
