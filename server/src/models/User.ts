import mongoose, { Schema } from "mongoose";
import type { DonorType, GeoPoint, RecipientType, Role } from "../types.js";

export interface UserDoc extends mongoose.Document {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: Role;
  organizationName?: string;
  donorType?: DonorType;
  recipientType?: RecipientType;
  address: string;
  location: GeoPoint;
  isVerified: boolean;
  emailVerified: boolean;
  emailVerifyTokenHash?: string;
  emailVerifyExpires?: Date;
  isFlagged: boolean;
  createdAt: Date;
}

const geoSchema = new Schema<GeoPoint>(
  {
    type: { type: String, enum: ["Point"], required: true, default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);

const userSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["DONOR", "RECIPIENT", "ADMIN"], required: true },
    organizationName: { type: String, trim: true },
    donorType: { type: String },
    recipientType: { type: String },
    address: { type: String, required: true, trim: true },
    location: { type: geoSchema, required: true },
    isVerified: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    emailVerifyTokenHash: { type: String },
    emailVerifyExpires: { type: Date },
    isFlagged: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

userSchema.index({ location: "2dsphere" });
userSchema.index({ role: 1 });

export const User = mongoose.model<UserDoc>("User", userSchema);
