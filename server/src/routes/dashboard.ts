import { Router } from "express";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";
import { adminDashboard, donorDashboard, recipientDashboard } from "../services/dashboard.js";
import { donorAnalytics } from "../services/analytics.js";
import { recipientHeatmap } from "../services/heatmap.js";
import { recipientReliability } from "../services/reliability.js";
import { serializeClaim, serializeDonation } from "../services/serialize.js";
import { Donation } from "../models/Donation.js";
import { Claim } from "../models/Claim.js";

export const dashboardRouter = Router();

dashboardRouter.get("/donor", requireAuth, requireRole("DONOR"), async (req: AuthedRequest, res, next) => {
  try {
    const [stats, extra] = await Promise.all([
      donorDashboard(req.user!.id),
      donorAnalytics(req.user!.id),
    ]);
    res.json({
      ...stats,
      ...extra,
      recentDonations: stats.recentDonations.map((d) =>
        serializeDonation(d, { role: "DONOR", userId: req.user!.id }),
      ),
    });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/recipient", requireAuth, requireRole("RECIPIENT"), async (req: AuthedRequest, res, next) => {
  try {
    const [stats, reliability, heatmap] = await Promise.all([
      recipientDashboard(req.user!.id),
      recipientReliability(req.user!.id),
      recipientHeatmap(req.user!.id),
    ]);
    const claims = await Claim.find({ _id: { $in: stats.recentClaims.map((c) => c._id) } });
    const donations = await Donation.find({ _id: { $in: claims.map((c) => c.donationId) } });
    res.json({
      ...stats,
      reliability,
      heatmap,
      recentClaims: stats.recentClaims.map((c) =>
        serializeClaim(c, {
          donation: (() => {
            const d = donations.find((x) => x.id === String(c.donationId));
            return d
              ? serializeDonation(d, { role: "RECIPIENT", userId: req.user!.id, hasClaim: true })
              : undefined;
          })(),
          viewerId: req.user!.id,
        }),
      ),
    });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/admin", requireAuth, requireRole("ADMIN"), async (_req, res, next) => {
  try {
    res.json(await adminDashboard());
  } catch (err) {
    next(err);
  }
});
