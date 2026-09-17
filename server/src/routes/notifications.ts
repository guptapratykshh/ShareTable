import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { Notification } from "../models/Notification.js";
import { AppError } from "../utils.js";

export const notificationsRouter = Router();

notificationsRouter.get("/", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const notifications = await Notification.find({ recipientId: req.user!.id })
      .sort({ createdAt: -1 })
      .limit(50);
    const unreadCount = await Notification.countDocuments({ recipientId: req.user!.id, isRead: false });
    res.json({
      unreadCount,
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        donationId: n.donationId ? String(n.donationId) : undefined,
        claimId: n.claimId ? String(n.claimId) : undefined,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.patch("/:id/read", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const notification = await Notification.findOne({ _id: req.params.id, recipientId: req.user!.id });
    if (!notification) throw new AppError("Notification not found.", 404);
    notification.isRead = true;
    await notification.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
