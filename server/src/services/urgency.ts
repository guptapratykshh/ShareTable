/**
 * Rescue urgency is operational, not a worthiness score.
 *
 * timeUrgency       = (1 - minutesLeft/60) * 60   // dominant: food about to expire
 * escalationUrgency = (level-1) * 20
 * quantityUrgency   = (available/quantity) * 20   // secondary leftover signal
 * score = clamp(0, 100)
 */
import type { UrgencyBand } from "../types.js";

export function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export function computeUrgency(donation: {
  expiresAt: Date;
  quantity: number;
  availableQuantity: number;
  escalationLevel?: number;
}): { score: number; band: UrgencyBand } {
  const minutesLeft = Math.max(0, (donation.expiresAt.getTime() - Date.now()) / 60_000);
  const timeUrgency = (1 - Math.min(minutesLeft, 60) / 60) * 60;
  const level = donation.escalationLevel ?? 1;
  const escalationUrgency = (level - 1) * 20;
  const quantityUrgency = donation.quantity > 0 ? (donation.availableQuantity / donation.quantity) * 20 : 0;
  const score = clamp(timeUrgency + escalationUrgency + quantityUrgency);

  let band: UrgencyBand = "NORMAL";
  if (level >= 3 || minutesLeft <= 15) band = "CRITICAL";
  else if (level >= 2) band = "EXPANDED";

  return { score, band };
}

export function urgencyLabel(band: UrgencyBand) {
  if (band === "CRITICAL") return "URGENT RESCUE";
  if (band === "EXPANDED") return "RESCUE EXPANDED";
  return "NORMAL RESCUE";
}
