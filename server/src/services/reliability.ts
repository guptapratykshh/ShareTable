/**
 * Operational reliability (0-100), NOT deservingness, poverty, or trustworthiness.
 *
 * score =
 *   40% successful pickup rate (PICKED_UP / all claims)
 * + 30% on-time rate (PICKED_UP with pickedUpAt <= pickupDeadline)
 * + 20% (1 - cancellationRate)
 * + 10% (1 - noShowRate)
 *
 * On-time uses pickedUpAt, falling back to completedAt for claims created before that field.
 * Computed from Claim records only, never stored on User.
 */
import mongoose from "mongoose";
import { Claim } from "../models/Claim.js";
import { clamp } from "./urgency.js";

export async function recipientReliability(recipientId: string) {
  const claims = await Claim.find({ recipientId: new mongoose.Types.ObjectId(recipientId) });
  const total = claims.length;
  if (!total) {
    return {
      score: null as number | null,
      sampleSize: 0,
      successfulPickupRate: 0,
      onTimeRate: 0,
      cancellationRate: 0,
      noShowRate: 0,
      successfulRescues: 0,
      label: "Operational reliability",
    };
  }

  const picked = claims.filter((c) => c.status === "PICKED_UP");
  const cancelled = claims.filter((c) => c.status === "CANCELLED").length;
  const noShows = claims.filter((c) => c.status === "NO_SHOW").length;
  const successfulPickupRate = picked.length / total;
  const onTime = picked.filter((c) => {
    const when = c.pickedUpAt || c.completedAt;
    return when && when.getTime() <= c.pickupDeadline.getTime();
  }).length;
  const onTimeRate = picked.length ? onTime / picked.length : 0;
  const cancellationRate = cancelled / total;
  const noShowRate = noShows / total;
  const score = clamp(
    100 * (0.4 * successfulPickupRate + 0.3 * onTimeRate + 0.2 * (1 - cancellationRate) + 0.1 * (1 - noShowRate)),
  );

  return {
    score: Number(score.toFixed(1)),
    sampleSize: total,
    successfulPickupRate: Number((successfulPickupRate * 100).toFixed(1)),
    onTimeRate: Number((onTimeRate * 100).toFixed(1)),
    cancellationRate: Number((cancellationRate * 100).toFixed(1)),
    noShowRate: Number((noShowRate * 100).toFixed(1)),
    successfulRescues: picked.reduce((s, c) => s + c.quantity, 0),
    label: "Operational reliability",
  };
}

export async function reliabilityMap(recipientIds: string[]) {
  const entries = await Promise.all(recipientIds.map(async (id) => [id, await recipientReliability(id)] as const));
  return Object.fromEntries(entries);
}
