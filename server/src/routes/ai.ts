import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { config } from "../config.js";
import { converseText } from "../services/llm.js";
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

    if (!config.llmEnabled) {
      return res.json({
        available: false,
        error: "AI unavailable.",
        description: parsed.data.text,
      });
    }

    try {
      const text = await converseText(
        `Turn this surplus-food note into a clear, appetizing donation description. Also pick one category from: ${FOOD_CATEGORIES.join(", ")}. Do not make food-safety claims or medical guarantees. Do not invent a meal count. Return JSON only: {"description":"...","category":"...","mealType":"..."}\n\nNote: ${parsed.data.text}`,
        300,
      );
      const match = text.match(/\{[\s\S]*\}/);
      const data = match ? JSON.parse(match[0]) : { description: parsed.data.text };
      console.log(JSON.stringify({ event: "llm describe-food", provider: config.llmProvider, ok: true }));
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
