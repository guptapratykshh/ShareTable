import { config } from "../config.js";
import { converseBedrock } from "./bedrock.js";
import { converseGroq } from "./groq.js";


let lastOkAt = 0;

export function lastLlmOkAt() {
  return lastOkAt;
}

export function llmRecentlyOk(windowMs = 15 * 60_000) {
  return lastOkAt > 0 && Date.now() - lastOkAt < windowMs;
}

export function llmHealth(windowMs = 15 * 60_000) {
  return {
    provider: config.llmProvider,
    model: config.llmModel,
    ok: llmRecentlyOk(windowMs),
  };
}

export async function converseText(prompt: string, maxTokens = 300): Promise<string> {
  if (!config.llmEnabled) throw new Error("LLM not configured");
  const text =
    config.llmProvider === "bedrock"
      ? await converseBedrock(prompt, maxTokens)
      : config.llmProvider === "groq"
        ? await converseGroq(prompt, maxTokens)
        : await Promise.reject(new Error("LLM not configured"));
  lastOkAt = Date.now();
  return text;
}
