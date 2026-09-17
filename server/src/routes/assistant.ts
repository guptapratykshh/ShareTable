import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { AppError } from "../utils.js";
import { handleAssistantMessage } from "../assistant/handle.js";
import { cancelPendingAction, getPendingAction, markPendingConsumed } from "../assistant/pending.js";
import { executePendingAction } from "../assistant/actions.js";

export const assistantRouter = Router();

const messageSchema = z.object({
  message: z.string().trim().min(1).max(500),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .max(12)
    .optional(),
});

const confirmSchema = z.object({
  pendingActionId: z.string().uuid(),
});

assistantRouter.post("/", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError("Send a short message.");
    const result = await handleAssistantMessage({
      userId: req.user!.id,
      role: req.user!.role,
      message: parsed.data.message,
      history: parsed.data.history,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

assistantRouter.post("/confirm", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError("Confirmation id is required.");
    const pending = getPendingAction(parsed.data.pendingActionId);
    if (!pending) throw new AppError("This confirmation is no longer available.", 404);
    if (pending.userId !== req.user!.id) {
      throw new AppError("You cannot confirm this action.", 403);
    }
    if (pending.consumed && pending.result) {
      return res.json({ reply: pending.result.reply, factsUsed: ["pendingAction"] });
    }
    if (pending.expiresAt <= Date.now()) {
      throw new AppError("This confirmation expired. Send the request again.", 400);
    }
    const result = await executePendingAction({
      userId: req.user!.id,
      role: req.user!.role,
      pending,
    });
    markPendingConsumed(pending.id, result);
    res.json({ reply: result.reply, factsUsed: ["pendingAction"] });
  } catch (err) {
    next(err);
  }
});

assistantRouter.post("/cancel", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError("Confirmation id is required.");
    const pending = getPendingAction(parsed.data.pendingActionId);
    if (pending && pending.userId !== req.user!.id) {
      throw new AppError("You cannot cancel this action.", 403);
    }
    cancelPendingAction(parsed.data.pendingActionId, req.user!.id);
    res.json({ reply: "Cancelled. Nothing was sent.", factsUsed: [] });
  } catch (err) {
    next(err);
  }
});
