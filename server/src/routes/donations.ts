import { Router } from "express";
import { z } from "zod";
import { config, maxRescueRadiusKm } from "../config.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { Claim } from "../models/Claim.js";
import { Donation } from "../models/Donation.js";
import { User } from "../models/User.js";
import { claimMeals, cancelDonation } from "../services/claims.js";
import { expireDonationIfNeeded, expireStaleDonations } from "../services/expiration.js";
import { distanceBetween, findNearbyDonations, findNearbyRecipients } from "../services/geo.js";
import { serializeClaim, serializeDonation } from "../services/serialize.js";
import { reliabilityMap } from "../services/reliability.js";
import { FOOD_CATEGORIES } from "../types.js";
import { AppError, kmLabel, point, routeId } from "../utils.js";

export const donationsRouter = Router();

const createSchema = z.object({
  foodName: z.string().trim().min(2).max(120),
  description: z.string().trim().min(4).max(1000),
  quantity: z.coerce.number().int().min(1).max(10000),
  category: z.enum(FOOD_CATEGORIES),
  preparedAt: z.string().optional(),
  bestBefore: z.string().optional(),
  storageCondition: z.string().trim().max(200).optional(),
  address: z.string().trim().min(3).max(200),
  pickupInstructions: z.string().trim().max(500).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  location: z.object({
    lat: z.coerce.number().gte(-90).lte(90),
    lng: z.coerce.number().gte(-180).lte(180),
  }),
  safetyConfirmed: z.literal(true),
});

donationsRouter.post("/", requireAuth, requireRole("DONOR"), async (req: AuthedRequest, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid donation details.";
      if (msg.toLowerCase().includes("safety")) {
        throw new AppError("Please confirm that the food is suitable for donation and has been handled safely.");
      }
      throw new AppError(msg);
    }
    const data = parsed.data;
    const location = point(data.location.lng, data.location.lat);
    const nearby = await findNearbyRecipients(location, config.rescueRadiusLevels[0] ?? config.defaultRadiusKm);
    const now = new Date();
    const notifiedAt = now;
    const level1 = 1;

    const donation = await Donation.create({
      donorId: req.user!.id,
      foodName: data.foodName,
      description: data.description,
      category: data.category,
      quantity: data.quantity,
      availableQuantity: data.quantity,
      preparedAt: data.preparedAt ? new Date(data.preparedAt) : undefined,
      bestBefore: data.bestBefore ? new Date(data.bestBefore) : undefined,
      storageCondition: data.storageCondition,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      location,
      address: data.address,
      pickupInstructions: data.pickupInstructions,
      imageUrl: data.imageUrl || undefined,
      status: "ACTIVE",
      safetyConfirmed: true,
      notifiedRecipientCount: nearby.length,
      escalationLevel: 1,
      currentRadiusKm: config.rescueRadiusLevels[0] ?? config.defaultRadiusKm,
      lastEscalatedAt: now,
      notifiedRecipients: nearby.map((r) => ({
        recipientId: r.id,
        level: level1,
        notifiedAt,
      })),
    });

    const { Notification } = await import("../models/Notification.js");
    if (nearby.length) {
      await Notification.insertMany(
        nearby.map((r) => ({
          recipientId: r.id,
          type: "NEW_DONATION",
          title: "New food donation nearby",
          message: `${data.quantity} meals available\nFood: ${data.foodName}\nDistance: ${kmLabel(r.distanceKm)}\nPickup: available for the next 1 hour`,
          donationId: donation._id,
        })),
      );
    }

    res.status(201).json({
      donation: serializeDonation(donation, { role: "DONOR", userId: req.user!.id }),
      notifiedRecipientCount: nearby.length,
      nearbyRecipients: nearby.map((r) => ({
        name: r.name,
        recipientType: r.recipientType,
        distanceKm: Number(r.distanceKm.toFixed(2)),
      })),
    });
  } catch (err) {
    next(err);
  }
});

donationsRouter.get("/nearby", requireAuth, requireRole("RECIPIENT"), async (req: AuthedRequest, res, next) => {
  try {
    const recipient = await User.findById(req.user!.id);
    if (!recipient) throw new AppError("Account not found.", 404);
    const lat = req.query.lat ? Number(req.query.lat) : recipient.location.coordinates[1];
    const lng = req.query.lng ? Number(req.query.lng) : recipient.location.coordinates[0];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new AppError("Invalid coordinates.");
    }

    const origin = point(lng, lat);
    const rows = await findNearbyDonations(origin);

    res.json({
      radiusKm: config.rescueRadiusLevels[0] ?? config.defaultRadiusKm,
      maxRadiusKm: maxRescueRadiusKm(),
      donations: rows.map((d) => {
        const distanceKm = (d.distanceMeters as number) / 1000;
        return serializeDonation(d as never, {
          role: "RECIPIENT",
          userId: req.user!.id,
          distanceKm,
          hasClaim: false,
        });
      }),
    });
  } catch (err) {
    next(err);
  }
});

donationsRouter.get("/", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await expireStaleDonations();
    const { role, id } = req.user!;
    if (role === "DONOR") {
      const donations = await Donation.find({ donorId: id }).sort({ createdAt: -1 });
      return res.json({
        donations: donations.map((d) => serializeDonation(d, { role, userId: id })),
      });
    }
    if (role === "ADMIN") {
      const donations = await Donation.find().sort({ createdAt: -1 }).limit(200);
      return res.json({
        donations: donations.map((d) => serializeDonation(d, { role, userId: id })),
      });
    }
    throw new AppError("Use /api/donations/nearby to find available food.", 400);
  } catch (err) {
    next(err);
  }
});

donationsRouter.get("/:id", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const donation = await Donation.findById(routeId(req.params.id));
    if (!donation) throw new AppError("Donation not found.", 404);
    await expireDonationIfNeeded(donation);
    const { escalateDonationIfNeeded } = await import("../services/escalation.js");
    await escalateDonationIfNeeded(donation);

    const user = await User.findById(req.user!.id);
    if (!user) throw new AppError("Account not found.", 404);

    const myClaims = await Claim.find({ donationId: donation._id, recipientId: user._id }).sort({
      claimedAt: -1,
    });
    const claim =
      myClaims.find((c) => ["CLAIMED", "PICKUP_PENDING"].includes(c.status)) ?? myClaims[0];
    const isOwner = String(donation.donorId) === req.user!.id;
    const distanceKm = distanceBetween(user.location, donation.location);

    let claims: ReturnType<typeof serializeClaim>[] | undefined;
    if (isOwner || req.user!.role === "ADMIN") {
      const rows = await Claim.find({ donationId: donation._id }).sort({ claimedAt: -1 });
      const recipients = await User.find({ _id: { $in: rows.map((c) => c.recipientId) } });
      const reports = await reliabilityMap(recipients.map((r) => r.id));
      claims = rows.map((c) => {
        const r = recipients.find((u) => u.id === String(c.recipientId));
        return serializeClaim(c, {
          recipient: r
            ? {
                id: r.id,
                name: r.name,
                organizationName: r.organizationName,
                reliabilityScore: reports[r.id]?.score ?? null,
              }
            : undefined,
          viewerId: req.user!.id,
        });
      });
    }

    res.json({
      donation: serializeDonation(donation, {
        role: req.user!.role,
        userId: req.user!.id,
        distanceKm,
        hasClaim: Boolean(claim) || isOwner || req.user!.role === "ADMIN",
      }),
      claims,
      myClaim: claim
        ? serializeClaim(claim, {
            donation: serializeDonation(donation, {
              role: req.user!.role,
              userId: req.user!.id,
              distanceKm,
              hasClaim: true,
            }),
            viewerId: req.user!.id,
          })
        : undefined,
    });
  } catch (err) {
    next(err);
  }
});

donationsRouter.get("/:id/rescue-status", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const donation = await Donation.findById(routeId(req.params.id));
    if (!donation) throw new AppError("Donation not found.", 404);
    await expireDonationIfNeeded(donation);
    const { escalateDonationIfNeeded, rescueStatusPayload } = await import("../services/escalation.js");
    await escalateDonationIfNeeded(donation);
    const { computeUrgency, urgencyLabel } = await import("../services/urgency.js");
    const urgency = computeUrgency(donation);
    res.json({
      ...rescueStatusPayload(donation),
      urgencyBand: urgency.band,
      urgencyLabel: urgencyLabel(urgency.band),
      demoMode: config.demoMode,
    });
  } catch (err) {
    next(err);
  }
});

donationsRouter.post("/:id/demo-escalate", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    if (!config.demoMode) throw new AppError("Demo escalation is disabled.", 403);
    if (req.user!.role !== "DONOR" && req.user!.role !== "ADMIN") {
      throw new AppError("You cannot trigger demo escalation.", 403);
    }
    const donation = await Donation.findById(routeId(req.params.id));
    if (!donation) throw new AppError("Donation not found.", 404);
    if (req.user!.role === "DONOR" && String(donation.donorId) !== req.user!.id) {
      throw new AppError("You can only escalate your own donations.", 403);
    }
    await expireDonationIfNeeded(donation);
    const { forceNextEscalation } = await import("../services/escalation.js");
    const updated = await forceNextEscalation(donation);
    res.json({
      donation: serializeDonation(updated, { role: req.user!.role, userId: req.user!.id }),
      newlyNotified: updated.notifiedRecipientCount,
    });
  } catch (err) {
    next(err);
  }
});

donationsRouter.post("/:id/claim", requireAuth, requireRole("RECIPIENT"), async (req: AuthedRequest, res, next) => {
  try {
    const quantity = Number(req.body?.quantity);
    const { claim, donation, distanceKm } = await claimMeals({
      donationId: routeId(req.params.id),
      recipientId: req.user!.id,
      quantity,
    });
    res.status(201).json({
      claim: serializeClaim(claim, {
        donation: serializeDonation(donation, {
          role: "RECIPIENT",
          userId: req.user!.id,
          distanceKm,
          hasClaim: true,
        }),
        viewerId: req.user!.id,
      }),
      donation: serializeDonation(donation, {
        role: "RECIPIENT",
        userId: req.user!.id,
        distanceKm,
        hasClaim: true,
      }),
    });
  } catch (err) {
    next(err);
  }
});

donationsRouter.patch("/:id", requireAuth, requireRole("DONOR"), async (req: AuthedRequest, res, next) => {
  try {
    if (req.body?.status === "CANCELLED") {
      const donation = await cancelDonation(routeId(req.params.id), req.user!.id);
      return res.json({ donation: serializeDonation(donation, { role: "DONOR", userId: req.user!.id }) });
    }
    throw new AppError("Only cancellation is supported on this endpoint.");
  } catch (err) {
    next(err);
  }
});

donationsRouter.delete("/:id", requireAuth, requireRole("DONOR"), async (req: AuthedRequest, res, next) => {
  try {
    const donation = await cancelDonation(routeId(req.params.id), req.user!.id);
    res.json({ donation: serializeDonation(donation, { role: "DONOR", userId: req.user!.id }) });
  } catch (err) {
    next(err);
  }
});
