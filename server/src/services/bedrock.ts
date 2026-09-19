import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { config } from "../config.js";

let lastOkAt = 0;

export function lastBedrockOkAt() {
  return lastOkAt;
}

export function bedrockRecentlyOk(windowMs = 15 * 60_000) {
  return lastOkAt > 0 && Date.now() - lastOkAt < windowMs;
}

export async function converseBedrock(prompt: string, maxTokens = 300): Promise<string> {
  if (!config.bedrockModelId) throw new Error("Bedrock model not configured");
  const client = new BedrockRuntimeClient({ region: config.awsRegion });
  const response = await client.send(
    new ConverseCommand({
      modelId: config.bedrockModelId,
      messages: [{ role: "user", content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens, temperature: 0.2 },
    }),
  );
  const text =
    response.output?.message?.content
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";
  lastOkAt = Date.now();
  console.log(
    JSON.stringify({
      event: "bedrock",
      model: config.bedrockModelId,
      ok: true,
      at: new Date().toISOString(),
    }),
  );
  return text;
}
