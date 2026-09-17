import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User.js";
import { requireAuth, signToken, type AuthedRequest } from "../middleware/auth.js";
import { publicUser } from "../services/serialize.js";
import { hashEmailVerifyToken, issueEmailVerification } from "../services/emailVerification.js";
import { DONOR_TYPES, RECIPIENT_TYPES, isDemoLoginEmail } from "../types.js";
import { AppError, point } from "../utils.js";

export const authRouter = Router();

const locationSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email(),
    phone: z.string().trim().min(8).max(20),
    password: z.string().min(8).max(72),
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

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const emailSchema = z.object({
  email: z.string().trim().email(),
});

const verifySchema = z.object({
  token: z.string().trim().min(16).max(128),
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "Invalid registration details.");
    }
    const data = parsed.data;
    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) throw new AppError("An account with this email already exists.", 409);

    const isNgo = data.role === "RECIPIENT" && data.recipientType === "NGO";
    const user = await User.create({
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone,
      passwordHash: await bcrypt.hash(data.password, 10),
      role: data.role,
      organizationName: data.organizationName,
      donorType: data.donorType,
      recipientType: data.recipientType,
      address: data.address,
      location: point(data.location.lng, data.location.lat),
      isVerified: !isNgo,
      emailVerified: false,
    });

    await issueEmailVerification(user).catch((err) => {
      console.error("[mail] Verification email was not sent after register", err);
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError("Enter a valid email and password.");
    const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (!user) throw new AppError("Invalid email or password.", 401);
    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) throw new AppError("Invalid email or password.", 401);
    if (user.isFlagged) throw new AppError("This account has been restricted.", 403);
    if (user.emailVerified === false && !isDemoLoginEmail(user.email)) {
      throw new AppError("Verify your email before logging in.", 403);
    }
    const token = signToken(user.id, user.role);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/verify-email", async (req, res, next) => {
  try {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("This verification link is invalid or has expired. Request a new one.");
    }
    const hash = hashEmailVerifyToken(parsed.data.token);
    const user = await User.findOneAndUpdate(
      {
        emailVerifyTokenHash: hash,
        emailVerifyExpires: { $gt: new Date() },
      },
      { $set: { emailVerified: true } },
    );
    if (!user) {
      throw new AppError("This verification link is invalid or has expired. Request a new one.");
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/resend-verification", async (req, res, next) => {
  try {
    const parsed = emailSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError("Enter a valid email address.");
    const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (user && user.emailVerified === false && !isDemoLoginEmail(user.email)) {
      await issueEmailVerification(user);
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) throw new AppError("Account not found.", 404);
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});
