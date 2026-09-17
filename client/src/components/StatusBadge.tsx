export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-primary/10 text-primary",
    PARTIALLY_CLAIMED: "bg-warn/15 text-warn",
    FULLY_CLAIMED: "bg-secondary text-foreground",
    EXPIRED: "bg-secondary text-muted",
    COMPLETED: "bg-primary/10 text-primary",
    CANCELLED: "bg-alert/10 text-alert",
    PICKUP_PENDING: "bg-warn/15 text-warn",
    PICKED_UP: "bg-rescued/15 text-rescued",
    CLAIMED: "bg-primary/10 text-primary",
    NO_SHOW: "bg-secondary text-muted",
    NORMAL: "bg-primary/10 text-primary",
    EXPANDED: "bg-warn/15 text-warn",
    CRITICAL: "bg-alert/10 text-alert",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${styles[status] ?? "bg-secondary text-foreground"}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function RescueBadge({ band, label }: { band?: string; label?: string }) {
  const text =
    label ||
    (band === "CRITICAL" ? "URGENT RESCUE" : band === "EXPANDED" ? "RESCUE EXPANDED" : "NORMAL RESCUE");
  const key = band === "CRITICAL" ? "CRITICAL" : band === "EXPANDED" ? "EXPANDED" : "NORMAL";
  const styles: Record<string, string> = {
    NORMAL: "bg-primary/10 text-primary",
    EXPANDED: "bg-warn/15 text-warn",
    CRITICAL: "bg-alert/10 text-alert",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${styles[key]}`}>
      {text}
    </span>
  );
}
