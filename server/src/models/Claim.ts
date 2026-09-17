import mongoose, { Schema, Types } from "mongoose";
import type { ClaimStatus } from "../types.js";

export interface ClaimDoc extends mongoose.Document {
  donationId: Types.ObjectId;
  recipientId: Types.ObjectId;
  /** Immutable after creation. Analytics: rescued = sum(quantity where PICKED_UP). */
  quantity: number;
  status: ClaimStatus;
  claimCode: string;
  claimedAt: Date;
  pickupDeadline: Date;
  completedAt?: Date;
  pickedUpAt?: Date;
  pickupDurationMinutes?: number;
}

const claimSchema = new Schema<ClaimDoc>(
  {
    donationId: { type: Schema.Types.ObjectId, ref: "Donation", required: true, index: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    quantity: { type: Number, required: true, min: 1, immutable: true },
    status: {
      type: String,
      enum: ["CLAIMED", "PICKUP_PENDING", "PICKED_UP", "CANCELLED", "NO_SHOW"],
      default: "PICKUP_PENDING",
      index: true,
    },
    claimCode: { type: String, required: true, unique: true },
    claimedAt: { type: Date, default: Date.now, index: true },
    pickupDeadline: { type: Date, required: true },
    completedAt: { type: Date },
    pickedUpAt: { type: Date, index: true },
    pickupDurationMinutes: { type: Number },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

claimSchema.index({ recipientId: 1, claimedAt: -1 });
claimSchema.index({ status: 1, pickedUpAt: 1 });

claimSchema.pre("save", function () {
  if (!this.isNew && this.isModified("quantity")) {
    this.unmarkModified("quantity");
  }
});

export const Claim = mongoose.model<ClaimDoc>("Claim", claimSchema);
