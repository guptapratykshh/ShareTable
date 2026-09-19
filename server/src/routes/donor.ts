import { Router } from "express";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { donorAnalytics } from "../services/analytics.js";
import { donorPatterns } from "../services/patterns.js";

export const donorRouter = Router();

donorRouter.get("/analytics", requireAuth, requireRole("DONOR"), async (req: AuthedRequest, res, next) => {
  try {
    res.json(await donorAnalytics(req.user!.id));
  } catch (err) {
    next(err);
  }
});

donorRouter.get("/patterns", requireAuth, requireRole("DONOR"), async (req: AuthedRequest, res, next) => {
  try {
    res.json(await donorPatterns(req.user!.id));
  } catch (err) {
    next(err);
  }
});
