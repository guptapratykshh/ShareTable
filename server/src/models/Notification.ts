import mongoose, { Schema, Types } from "mongoose";
import type { NotificationType } from "../types.js";

export interface NotificationDoc extends mongoose.Document {
  recipientId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  donationId?: Types.ObjectId;
  claimId?: Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationDoc>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    donationId: { type: Schema.Types.ObjectId, ref: "Donation" },
    claimId: { type: Schema.Types.ObjectId, ref: "Claim" },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });

export const Notification = mongoose.model<NotificationDoc>("Notification", notificationSchema);
