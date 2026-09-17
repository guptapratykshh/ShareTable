export function remainingMs(expiresAt: string) {
  return new Date(expiresAt).getTime() - Date.now();
}

export function formatRemaining(expiresAt: string) {
  const ms = remainingMs(expiresAt);
  if (ms <= 0) return "Expired";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m remaining`;
  }
  if (minutes < 1) return `${seconds}s remaining`;
  return `${minutes} min remaining`;
}

export function formatTime(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function allergenLine(allergens?: string[]) {
  if (!allergens?.length) return "Allergens not declared";
  return `Contains: ${allergens.join(", ")}`;
}
