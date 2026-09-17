import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { config } from "../config.js";
import { ASSISTANT_INTENTS, type AssistantChatMessage, type AssistantFacts, type AssistantIntent, type ClassifiedIntent } from "./types.js";
import { knowledgeForPrompt, matchKnowledge } from "./knowledge.js";
import { extractHintIds } from "./actions.js";
import { factsForPrompt } from "./facts.js";
import { sanitizeInstructions } from "./copy.js";

const INTENT_SET = new Set<string>(ASSISTANT_INTENTS);

function parseDelayMinutes(message: string, fromModel?: number) {
  if (Number.isFinite(fromModel) && fromModel && fromModel >= 1) {
    return Math.min(180, Math.max(1, Math.round(fromModel)));
  }
  const match = message.match(/(\d{1,3})\s*(?:min|mins|minute|minutes)\b/i);
  if (match) return Math.min(180, Math.max(1, Number(match[1])));
  return 10;
}

function objectIdHint(value: unknown, extra: string[]) {
  const raw = typeof value === "string" ? value : "";
  if (/^[a-f0-9]{24}$/i.test(raw)) return raw;
  return extra[0];
}

export function isPersonalPickupTime(message: string) {
  const text = message.toLowerCase();
  const mine = /\b(my|mine|i|i'm|im|our|we)\b/.test(text);
  const when = /\b(expire|expiry|deadline|what time|until when|when (?:do|does|is|will)|pick(?:\s*up)?(?:\s+meal)?)\b/.test(
    text,
  );
  return mine && when;
}

export function classifyWithKeywords(message: string): ClassifiedIntent {
  const text = message.toLowerCase();
  const ids = extractHintIds(message);

  if (/\b(late|running behind|delay|delayed)\b/.test(text) || /\d+\s*(min|mins|minutes)\s+late/.test(text)) {
    return { intent: "LATE", delayMinutes: parseDelayMinutes(message), claimId: ids[0] };
  }
  if (
    /security guard|pickup instructions|kept near|left (it |the food )?at|i've kept|ive kept|update instructions/.test(
      text,
    )
  ) {
    return {
      intent: "UPDATE_INSTRUCTIONS",
      instructions: sanitizeInstructions(message),
      donationId: ids[0],
      claimId: ids[1],
    };
  }
  if (/\b(arrived|i'm here|im here|at the door|outside|we're here|we are here)\b/.test(text)) {
    return { intent: "ARRIVED", claimId: ids[0] };
  }
  if (isPersonalPickupTime(message)) {
    return { intent: "QUERY_PICKUP", claimId: ids[0] };
  }
  if (
    /how many|meals rescued|meals picked|stats|rescued so far|picked up/.test(text) &&
    !/what counts|won't be counted|will not be counted/.test(text)
  ) {
    return { intent: "QUERY_STATS" };
  }
  if (/my pickup|reservation|where do i|pickup address|open pickup/.test(text)) {
    return { intent: "QUERY_PICKUP", claimId: ids[0] };
  }
  if (matchKnowledge(message)) return { intent: "FAQ" };
  return { intent: "UNKNOWN" };
}

function parseModelIntent(raw: string, message: string): ClassifiedIntent | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[0]) as Record<string, unknown>;
    const intent = typeof data.intent === "string" && INTENT_SET.has(data.intent) ? (data.intent as AssistantIntent) : "UNKNOWN";
    const ids = extractHintIds(message);
    const delay =
      typeof data.delayMinutes === "number"
        ? data.delayMinutes
        : typeof data.delayMinutes === "string"
          ? Number(data.delayMinutes)
          : undefined;
    return {
      intent,
      delayMinutes: intent === "LATE" ? parseDelayMinutes(message, delay) : undefined,
      instructions:
        intent === "UPDATE_INSTRUCTIONS"
          ? sanitizeInstructions(typeof data.instructions === "string" ? data.instructions : message)
          : undefined,
      claimId: objectIdHint(data.claimId, ids),
      donationId: objectIdHint(data.donationId, ids.slice(intent === "UPDATE_INSTRUCTIONS" ? 0 : 1)),
    };
  } catch {
    return null;
  }
}

async function invokeBedrockIntent(message: string, history: AssistantChatMessage[], facts: AssistantFacts) {
  const client = new BedrockRuntimeClient({ region: config.awsRegion });
  const historyText = history
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  const command = new InvokeModelCommand({
    modelId: config.bedrockModelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Classify this ShareTable food-rescue message. Return JSON only with keys intent, delayMinutes, instructions, claimId, donationId.
Do not return reply, recipientId, donorId, quantity, or a pickup code.
intent must be one of: ${ASSISTANT_INTENTS.join(", ")}.
Use claimId/donationId only if they appear in the facts snapshot. Never invent ids.
LATE is for a recipient running late. UPDATE_INSTRUCTIONS is a donor changing pickup instructions. ARRIVED is either party at the door.

Facts JSON (source of truth): ${factsForPrompt(facts)}
Knowledge:
${knowledgeForPrompt()}
Recent chat:
${historyText || "(none)"}
Current message: ${message}`,
        },
      ],
    }),
  });
  const response = await client.send(command);
  const raw = new TextDecoder().decode(response.body);
  const json = JSON.parse(raw) as { content?: { text?: string }[] };
  return json.content?.[0]?.text ?? raw;
}

export async function classifyAssistantMessage(opts: {
  message: string;
  history: AssistantChatMessage[];
  facts: AssistantFacts;
}): Promise<ClassifiedIntent> {
  if (config.bedrockModelId) {
    try {
      const raw = await invokeBedrockIntent(opts.message, opts.history, opts.facts);
      const parsed = parseModelIntent(raw, opts.message);
      if (parsed) {
        if (isPersonalPickupTime(opts.message) && (parsed.intent === "FAQ" || parsed.intent === "UNKNOWN")) {
          return { ...parsed, intent: "QUERY_PICKUP" };
        }
        if (parsed.intent === "UNKNOWN" && matchKnowledge(opts.message)) {
          return { intent: "FAQ" };
        }
        return parsed;
      }
    } catch {
      // keyword fallback below
    }
  }
  return classifyWithKeywords(opts.message);
}

export async function maybeRephraseFaq(answer: string, message: string) {
  if (!config.bedrockModelId) return answer;
  try {
    const client = new BedrockRuntimeClient({ region: config.awsRegion });
    const command = new InvokeModelCommand({
      modelId: config.bedrockModelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 180,
        messages: [
          {
            role: "user",
            content: `Rephrase this ShareTable fact for the user in one or two sentences. Keep every number exactly. Do not add new facts.\nFact: ${answer}\nUser asked: ${message}`,
          },
        ],
      }),
    });
    const response = await client.send(command);
    const raw = new TextDecoder().decode(response.body);
    const json = JSON.parse(raw) as { content?: { text?: string }[] };
    return json.content?.[0]?.text?.trim() || answer;
  } catch {
    return answer;
  }
}
