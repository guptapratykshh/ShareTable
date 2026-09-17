import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { Donation } from "../models/Donation.js";
import { publicUser, serializeDonation } from "../services/serialize.js";
import { expireStaleDonations } from "../services/expiration.js";
import { adminHeatmap, rescueActivity } from "../services/heatmap.js";
import { recipientReliability } from "../services/reliability.js";
import { AppError } from "../utils.js";
import { ROLES, type Role } from "../types.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.get("/users", async (req: AuthedRequest, res, next) => {
  try {
    const role = typeof req.query.role === "string" && ROLES.includes(req.query.role as Role)
      ? (req.query.role as Role)
      : undefined;
    const users = await User.find(role ? { role } : {}).sort({ createdAt: -1 }).limit(300);
    res.json({ users: users.map(publicUser) });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/users/:id", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = z
      .object({
        isVerified: z.boolean().optional(),
        isFlagged: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) throw new AppError("Invalid update.");
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError("User not found.", 404);
    if (user.role === "ADMIN") throw new AppError("Admin accounts cannot be modified here.", 403);
    if (parsed.data.isVerified !== undefined) user.isVerified = parsed.data.isVerified;
    if (parsed.data.isFlagged !== undefined) user.isFlagged = parsed.data.isFlagged;
    await user.save();
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/heatmap", async (req: AuthedRequest, res, next) => {
  try {
    const range = typeof req.query.range === "string" ? req.query.range : "today";
    res.json(await adminHeatmap(range));
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/rescue-activity", async (_req, res, next) => {
  try {
    res.json(await rescueActivity());
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/reliability", async (_req, res, next) => {
  try {
    const users = await User.find({ role: "RECIPIENT" });
    const reports = await Promise.all(
      users.map(async (u) => ({
        id: u.id,
        name: u.organizationName || u.name,
        ...(await recipientReliability(u.id)),
      })),
    );
    res.json({ recipients: reports });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/donations", async (_req, res, next) => {
  try {
    await expireStaleDonations();
    const donations = await Donation.find().sort({ createdAt: -1 }).limit(300);
    res.json({
      donations: donations.map((d) => serializeDonation(d, { role: "ADMIN", userId: "admin" })),
    });
  } catch (err) {
    next(err);
  }
});
