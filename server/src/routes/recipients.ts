import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { Claim } from "../models/Claim.js";
import { Donation } from "../models/Donation.js";
import { User } from "../models/User.js";
import { recipientReliability } from "../services/reliability.js";
import { AppError, routeId } from "../utils.js";

export const recipientsRouter = Router();

recipientsRouter.get("/:id/reliability", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const id = routeId(req.params.id);
    if (req.user!.role === "RECIPIENT" && req.user!.id !== id) {
      throw new AppError("You cannot view this reliability report.", 403);
    }
    if (req.user!.role === "DONOR") {
      const owned = await Donation.find({ donorId: req.user!.id }).select("_id");
      const linked = await Claim.exists({
        recipientId: id,
        donationId: { $in: owned.map((d) => d._id) },
      });
      if (!linked) throw new AppError("You can only see claimants on your donations.", 403);
      const user = await User.findById(id).select("organizationName name");
      const report = await recipientReliability(id);
      return res.json({
        recipientId: id,
        organizationName: user?.organizationName || user?.name,
        score: report.score,
        label: report.label,
      });
    }
    if (req.user!.role !== "ADMIN" && req.user!.id !== id) {
      throw new AppError("You cannot view this reliability report.", 403);
    }
    const report = await recipientReliability(id);
    res.json({
      recipientId: id,
      ...report,
    });
  } catch (err) {
    next(err);
  }
});
