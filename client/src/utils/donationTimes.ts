function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function composeLocalDateTime(dateKey: string, hour: number, minute: number) {
  return `${dateKey}T${pad(hour)}:${pad(minute)}`;
}

export function toLocalDateTime(date: Date) {
  return composeLocalDateTime(toDateKey(date), date.getHours(), date.getMinutes());
}

export function parseLocalDateTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const next = new Date(value);
  return Number.isNaN(next.getTime()) ? null : next;
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatLocalDateTime(value: string) {
  const date = parseLocalDateTime(value);
  if (!date) return "";
  const day = date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return `${day} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function validateDonationTimes(preparedAt: string, bestBefore: string, now = new Date()) {
  const prepared = parseLocalDateTime(preparedAt);
  const best = parseLocalDateTime(bestBefore);
  if (!prepared || !best) return "Fill in storage, prepared time, and best before.";
  if (!sameDay(prepared, now) || prepared.getTime() > now.getTime()) {
    return "Prepared time has to be today and cannot be in the future.";
  }
  if (best.getTime() < now.getTime() || best.getTime() <= prepared.getTime()) {
    return "Best before cannot be earlier than now or the prepared time.";
  }
  return null;
}
