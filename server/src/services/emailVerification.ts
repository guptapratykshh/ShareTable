import crypto from "node:crypto";
import { config } from "../config.js";
import type { UserDoc } from "../models/User.js";
import { sendVerificationEmail } from "./mail.js";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

export function hashEmailVerifyToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createEmailVerifyToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    hash: hashEmailVerifyToken(token),
    expires: new Date(Date.now() + VERIFY_TTL_MS),
  };
}

function clientOrigin() {
  const origins = config.clientOrigin.split(",").map((s) => s.trim()).filter(Boolean);
  if (config.nodeEnv === "production") {
    return origins.find((origin) => origin.startsWith("https://")) || origins[0] || "http://localhost:5173";
  }
  return origins[0] || "http://localhost:5173";
}

export function verificationUrl(token: string) {
  return `${clientOrigin()}/verify-email?token=${encodeURIComponent(token)}`;
}

export async function issueEmailVerification(user: UserDoc) {
  const { token, hash, expires } = createEmailVerifyToken();
  user.emailVerifyTokenHash = hash;
  user.emailVerifyExpires = expires;
  await user.save();
  await sendVerificationEmail(user.email, verificationUrl(token));
}
