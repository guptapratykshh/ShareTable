import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";
import {
  createAdminClaim,
  createAdminDonation,
  createAdminUser,
  deleteAdminClaim,
  deleteAdminDonation,
  deleteAdminUser,
  getAdminClaim,
  getAdminDonation,
  getAdminUser,
  listAdminClaims,
  listAdminDonations,
  listAdminUsers,
  replaceAdminClaim,
  replaceAdminDonation,
  replaceAdminUser,
} from "../services/admin.js";
import { adminHeatmap, recipientHeatmap, rescueActivity } from "../services/heatmap.js";
import { publicUser } from "../services/serialize.js";
import { recipientReliability } from "../services/reliability.js";
import { DONOR_TYPES, FOOD_CATEGORIES, RECIPIENT_TYPES } from "../types.js";
import { AppError, routeId } from "../utils.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

const locationSchema = z.object({
  lat: z.coerce.number().gte(-90).lte(90),
  lng: z.coerce.number().gte(-180).lte(180),
});

const userWriteSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email(),
    phone: z.string().trim().min(8).max(20),
    password: z.string().min(8).max(72).optional(),
    role: z.enum(["DONOR", "RECIPIENT"]),
    organizationName: z.string().trim().max(120).optional(),
    address: z.string().trim().min(3).max(200),
    location: locationSchema,
    donorType: z.enum(DONOR_TYPES).optional(),
    recipientType: z.enum(RECIPIENT_TYPES).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "DONOR" && !data.donorType) {
      ctx.addIssue({ code: "custom", message: "Select a donor type.", path: ["donorType"] });
    }
    if (data.role === "RECIPIENT" && !data.recipientType) {
      ctx.addIssue({ code: "custom", message: "Select a recipient type.", path: ["recipientType"] });
    }
  });

const donationWriteSchema = z.object({
  donorId: z.string().min(1),
  foodName: z.string().trim().min(2).max(120),
  description: z.string().trim().min(4).max(1000),
  quantity: z.coerce.number().int().min(1).max(10000),
  category: z.enum(FOOD_CATEGORIES),
  preparedAt: z.string().optional(),
  bestBefore: z.string().optional(),
  storageCondition: z.string().trim().max(200).optional(),
  address: z.string().trim().min(3).max(200),
  pickupInstructions: z.string().trim().max(500).optional(),
  allergens: z.array(z.string().trim().min(1).max(40)).max(15).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  location: locationSchema,
  safetyConfirmed: z.literal(true),
});

const donationPutSchema = z.object({
  foodName: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().min(4).max(1000).optional(),
  category: z.enum(FOOD_CATEGORIES).optional(),
  preparedAt: z.string().optional(),
  bestBefore: z.string().optional(),
  storageCondition: z.string().trim().max(200).optional(),
  address: z.string().trim().min(3).max(200).optional(),
  pickupInstructions: z.string().trim().max(500).optional(),
  allergens: z.array(z.string().trim().min(1).max(40)).max(15).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  location: locationSchema.optional(),
  expiresAt: z.string().optional(),
});

const claimCreateSchema = z.object({
  donationId: z.string().min(1),
  recipientId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(10000),
});

const claimPutSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(10000).optional(),
  status: z.enum(["PICKUP_PENDING", "PICKED_UP", "CANCELLED", "NO_SHOW"]).optional(),
  claimCode: z.string().trim().optional(),
});

adminRouter.get("/users", async (req: AuthedRequest, res, next) => {
  try {
    const role = typeof req.query.role === "string" ? req.query.role : undefined;
    res.json({ users: await listAdminUsers(role) });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/users", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = userWriteSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Invalid user details.");
    if (!parsed.data.password) throw new AppError("Password is required.");
    const user = await createAdminUser({ ...parsed.data, password: parsed.data.password });
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/users/:id", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await getAdminUser(routeId(req.params.id), req.user!.id));
  } catch (err) {
    next(err);
  }
});

adminRouter.put("/users/:id", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = userWriteSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Invalid user details.");
    const user = await replaceAdminUser(routeId(req.params.id), parsed.data);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/users/:id", async (req: AuthedRequest, res, next) => {
  try {
    const user = await User.findById(routeId(req.params.id));
    if (!user) throw new AppError("User not found.", 404);
    if (typeof req.body.isVerified === "boolean") user.isVerified = req.body.isVerified;
    if (typeof req.body.isFlagged === "boolean") user.isFlagged = req.body.isFlagged;
    await user.save();
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/users/:id", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await deleteAdminUser(routeId(req.params.id)));
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/heatmap", async (req, res, next) => {
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

adminRouter.get("/collector-heatmap", async (req: AuthedRequest, res, next) => {
  try {
    const userId = typeof req.query.userId === "string" ? req.query.userId : req.user!.id;
    res.json(await recipientHeatmap(userId));
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/reliability", async (_req, res, next) => {
  try {
    const recipients = await User.find({ role: "RECIPIENT" });
    const rows = await Promise.all(
      recipients.map(async (u) => {
        const stats = await recipientReliability(u.id);
        return {
          id: u.id,
          name: u.organizationName || u.name,
          recipientType: u.recipientType,
          ...stats,
        };
      }),
    );
    res.json({
      label: "Operational reliability",
      note: "Computed from claim outcomes. Not stored on user records. Not a ranking of deservingness.",
      recipients: rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/donations", async (req: AuthedRequest, res, next) => {
  try {
    res.json({ donations: await listAdminDonations(req.user!.id) });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/donations", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = donationWriteSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid donation details.";
      if (msg.toLowerCase().includes("safety")) {
        throw new AppError("Please confirm that the food is suitable for donation and has been handled safely.");
      }
      throw new AppError(msg);
    }
    const { donorId, safetyConfirmed: _safety, ...data } = parsed.data;
    const result = await createAdminDonation(donorId, data, req.user!.id);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/donations/:id", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await getAdminDonation(routeId(req.params.id), req.user!.id));
  } catch (err) {
    next(err);
  }
});

adminRouter.put("/donations/:id", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = donationPutSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Invalid donation details.");
    const donation = await replaceAdminDonation(routeId(req.params.id), parsed.data, req.user!.id);
    res.json({ donation });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/donations/:id", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await deleteAdminDonation(routeId(req.params.id)));
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/claims", async (req: AuthedRequest, res, next) => {
  try {
    res.json({ claims: await listAdminClaims(req.user!.id) });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/claims", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = claimCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Invalid claim details.");
    const claim = await createAdminClaim(parsed.data, req.user!.id);
    res.status(201).json({ claim });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/claims/:id", async (req: AuthedRequest, res, next) => {
  try {
    res.json({ claim: await getAdminClaim(routeId(req.params.id), req.user!.id) });
  } catch (err) {
    next(err);
  }
});

adminRouter.put("/claims/:id", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = claimPutSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Invalid claim details.");
    const claim = await replaceAdminClaim(routeId(req.params.id), parsed.data, req.user!.id);
    res.json({ claim });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/claims/:id", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await deleteAdminClaim(routeId(req.params.id)));
  } catch (err) {
    next(err);
  }
});
