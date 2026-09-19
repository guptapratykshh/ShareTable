import { config } from "../config.js";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

let lastOkAt = 0;

export function lastGroqOkAt() {
  return lastOkAt;
}

export function groqRecentlyOk(windowMs = 15 * 60_000) {
  return lastOkAt > 0 && Date.now() - lastOkAt < windowMs;
}

export async function converseGroq(prompt: string, maxTokens = 300): Promise<string> {
  if (!config.groqApiKey) throw new Error("Groq API key not configured");
  const response = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.groqApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "ShareTable/1.0 (https://github.com/the-ivii/ShareTable)",
    },
    body: JSON.stringify({
      model: config.groqModel,
      temperature: 0.2,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Groq request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null; reasoning?: string } }>;
  };
  const message = payload.choices?.[0]?.message;
  const text = (message?.content ?? message?.reasoning ?? "").trim();
  lastOkAt = Date.now();
  console.log(
    JSON.stringify({
      event: "groq",
      model: config.groqModel,
      ok: true,
      at: new Date().toISOString(),
    }),
  );
  return text;
}
