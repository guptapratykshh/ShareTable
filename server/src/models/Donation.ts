import mongoose, { Schema, Types } from "mongoose";
import type { DonationStatus, FoodCategory, GeoPoint } from "../types.js";

export interface NotifiedRecipient {
  recipientId: Types.ObjectId;
  level: number;
  notifiedAt: Date;
}

export interface DonationDoc extends mongoose.Document {
  donorId: Types.ObjectId;
  foodName: string;
  description: string;
  category: FoodCategory;
  quantity: number;
  availableQuantity: number;
  preparedAt?: Date;
  bestBefore?: Date;
  storageCondition?: string;
  createdAt: Date;
  expiresAt: Date;
  location: GeoPoint;
  address: string;
  pickupInstructions?: string;
  imageUrl?: string;
  allergens: string[];
  status: DonationStatus;
  safetyConfirmed: boolean;
  notifiedRecipientCount: number;
  escalationLevel: number;
  currentRadiusKm: number;
  lastEscalatedAt?: Date;
  notifiedRecipients: NotifiedRecipient[];
}

const geoSchema = new Schema<GeoPoint>(
  {
    type: { type: String, enum: ["Point"], required: true, default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);

const notifiedSchema = new Schema<NotifiedRecipient>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    level: { type: Number, required: true },
    notifiedAt: { type: Date, required: true },
  },
  { _id: false },
);

const donationSchema = new Schema<DonationDoc>(
  {
    donorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    foodName: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    availableQuantity: { type: Number, required: true, min: 0 },
    preparedAt: { type: Date },
    bestBefore: { type: Date },
    storageCondition: { type: String },
    expiresAt: { type: Date, required: true, index: true },
    location: { type: geoSchema, required: true },
    address: { type: String, required: true },
    pickupInstructions: { type: String },
    imageUrl: { type: String },
    allergens: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["ACTIVE", "PARTIALLY_CLAIMED", "FULLY_CLAIMED", "EXPIRED", "COMPLETED", "CANCELLED"],
      default: "ACTIVE",
      index: true,
    },
    safetyConfirmed: { type: Boolean, required: true },
    notifiedRecipientCount: { type: Number, default: 0 },
    escalationLevel: { type: Number, default: 1, min: 1, max: 3, index: true },
    currentRadiusKm: { type: Number, default: 2.5 },
    lastEscalatedAt: { type: Date },
    notifiedRecipients: { type: [notifiedSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

donationSchema.index({ location: "2dsphere" });
donationSchema.index({ status: 1, expiresAt: 1 });
donationSchema.index({ createdAt: -1 });
donationSchema.index({ donorId: 1, createdAt: -1 });

export const Donation = mongoose.model<DonationDoc>("Donation", donationSchema);
