const SKEW_MS = 2 * 60_000;
const PREPARED_WINDOW_MS = 36 * 60 * 60_000;

export function donationTimeError(preparedAt?: string, bestBefore?: string, now = new Date()) {
  if (!preparedAt && !bestBefore) return null;
  if (!preparedAt || !bestBefore) return null;
  const prepared = new Date(preparedAt);
  const best = new Date(bestBefore);
  if (Number.isNaN(prepared.getTime()) || Number.isNaN(best.getTime())) {
    return "Prepared at and best before must be valid times.";
  }
  if (prepared.getTime() > now.getTime() + SKEW_MS) {
    return "Prepared at cannot be in the future.";
  }
  if (prepared.getTime() < now.getTime() - PREPARED_WINDOW_MS) {
    return "Prepared at must be today's date.";
  }
  if (best.getTime() < now.getTime() - SKEW_MS) {
    return "Best before cannot be earlier than now.";
  }
  if (best.getTime() <= prepared.getTime()) {
    return "Best before must be after the prepared time.";
  }
  return null;
}
