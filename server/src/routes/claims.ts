import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { Claim } from "../models/Claim.js";
import { Donation } from "../models/Donation.js";
import { User } from "../models/User.js";
import { completePickup } from "../services/claims.js";
import { distanceBetween } from "../services/geo.js";
import { serializeClaim, serializeDonation } from "../services/serialize.js";
import { AppError, routeId } from "../utils.js";

export const claimsRouter = Router();

claimsRouter.get("/", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const filter =
      req.user!.role === "RECIPIENT"
        ? { recipientId: req.user!.id }
        : req.user!.role === "DONOR"
          ? { donationId: { $in: (await Donation.find({ donorId: req.user!.id }).select("_id")).map((d) => d._id) } }
          : {};

    const claims = await Claim.find(filter).sort({ claimedAt: -1 }).limit(200);
    const donations = await Donation.find({ _id: { $in: claims.map((c) => c.donationId) } });
    const recipients = await User.find({ _id: { $in: claims.map((c) => c.recipientId) } });
    const me = await User.findById(req.user!.id);

    res.json({
      claims: claims.map((c) => {
        const donation = donations.find((d) => d.id === String(c.donationId));
        const recipient = recipients.find((u) => u.id === String(c.recipientId));
        const distanceKm =
          donation && me ? distanceBetween(me.location, donation.location) : undefined;
        return serializeClaim(c, {
          donation: donation
            ? serializeDonation(donation, {
                role: req.user!.role,
                userId: req.user!.id,
                distanceKm,
                hasClaim: true,
              })
            : undefined,
          recipient: recipient
            ? { id: recipient.id, name: recipient.name, organizationName: recipient.organizationName }
            : undefined,
          viewerId: req.user!.id,
        });
      }),
    });
  } catch (err) {
    next(err);
  }
});

claimsRouter.get("/:id", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const claim = await Claim.findById(routeId(req.params.id));
    if (!claim) throw new AppError("Claim not found.", 404);
    const donation = await Donation.findById(claim.donationId);
    if (!donation) throw new AppError("Donation not found.", 404);

    const isRecipient = String(claim.recipientId) === req.user!.id;
    const isDonor = String(donation.donorId) === req.user!.id;
    if (!isRecipient && !isDonor && req.user!.role !== "ADMIN") {
      throw new AppError("You cannot view this claim.", 403);
    }

    const recipient = await User.findById(claim.recipientId);
    const me = await User.findById(req.user!.id);
    const distanceKm = me ? distanceBetween(me.location, donation.location) : undefined;

    res.json({
      claim: serializeClaim(claim, {
        donation: serializeDonation(donation, {
          role: req.user!.role,
          userId: req.user!.id,
          distanceKm,
          hasClaim: true,
        }),
        recipient: recipient
          ? { id: recipient.id, name: recipient.name, organizationName: recipient.organizationName }
          : undefined,
        viewerId: req.user!.id,
      }),
    });
  } catch (err) {
    next(err);
  }
});

claimsRouter.patch("/:id", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { claim, donation } = await completePickup({
      claimId: routeId(req.params.id),
      actorId: req.user!.id,
      actorRole: req.user!.role,
      claimCode: req.body?.claimCode,
    });
    const me = await User.findById(req.user!.id);
    const distanceKm = me ? distanceBetween(me.location, donation.location) : undefined;
    res.json({
      claim: serializeClaim(claim, {
        donation: serializeDonation(donation, {
          role: req.user!.role,
          userId: req.user!.id,
          distanceKm,
          hasClaim: true,
        }),
        viewerId: req.user!.id,
      }),
    });
  } catch (err) {
    next(err);
  }
});
