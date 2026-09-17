import { Router } from "express";
import { z } from "zod";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { config } from "../config.js";
import { AppError } from "../utils.js";
import { FOOD_CATEGORIES } from "../types.js";

export const aiRouter = Router();

const bodySchema = z.object({
  text: z.string().trim().min(2).max(400),
});

aiRouter.post("/describe-food", requireAuth, requireRole("DONOR"), async (req, res, next) => {
  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) throw new AppError("Enter a short food description.");

    if (!config.bedrockModelId) {
      return res.json({
        available: false,
        error: "AI unavailable.",
        description: parsed.data.text,
      });
    }

    try {
      const client = new BedrockRuntimeClient({ region: config.awsRegion });
      const command = new InvokeModelCommand({
        modelId: config.bedrockModelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: `Turn this surplus-food note into a clear, appetizing donation description. Also pick one category from: ${FOOD_CATEGORIES.join(", ")}. Do not make food-safety claims or medical guarantees. Return JSON only: {"description":"...","category":"...","mealType":"..."}\n\nNote: ${parsed.data.text}`,
            },
          ],
        }),
      });
      const response = await client.send(command);
      const raw = new TextDecoder().decode(response.body);
      const json = JSON.parse(raw) as { content?: { text?: string }[] };
      const text = json.content?.[0]?.text ?? raw;
      const match = text.match(/\{[\s\S]*\}/);
      const data = match ? JSON.parse(match[0]) : { description: parsed.data.text };
      res.json({ available: true, ...data });
    } catch {
      res.json({
        available: false,
        error: "AI unavailable. You can still enter the description yourself.",
        description: parsed.data.text,
      });
    }
  } catch (err) {
    next(err);
  }
});
