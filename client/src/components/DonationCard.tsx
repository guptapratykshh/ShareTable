import { Clock3, MapPin, Utensils } from "lucide-react";
import { Link } from "react-router-dom";
import type { Donation } from "../types";
import { formatRemaining } from "../utils/format";
import { useCountdown } from "../hooks/useCountdown";
import { RescueBadge, StatusBadge } from "./StatusBadge";

export function DonationCard({
  donation,
  actionLabel = "View & Claim",
  to,
}: {
  donation: Donation;
  actionLabel?: string;
  to?: string;
}) {
  useCountdown(donation.expiresAt);
  const href = to ?? `/donation/${donation.id}`;

  return (
    <article className="flex flex-col rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="display text-lg font-semibold leading-snug">{donation.foodName}</h3>
        <StatusBadge status={donation.status} />
      </div>
      <div className="mb-3">
        <RescueBadge band={donation.urgencyBand} label={donation.urgencyLabel} />
      </div>
      <p className="flex items-center gap-2 text-sm font-medium">
        <Utensils className="h-4 w-4 text-accent" />
        {donation.availableQuantity} meals available
      </p>
      {donation.distanceKm !== undefined && (
        <p className="mt-1 flex items-center gap-2 text-sm text-muted">
          <MapPin className="h-4 w-4" />
          {donation.distanceKm.toFixed(1)} km away
        </p>
      )}
      <p className="mt-1 flex items-center gap-2 text-sm text-muted">
        <Clock3 className="h-4 w-4" />
        {formatRemaining(donation.expiresAt)}
      </p>
      {donation.currentRadiusKm !== undefined && (
        <p className="mt-1 text-xs text-muted">Rescue radius {donation.currentRadiusKm} km</p>
      )}
      <p className="mt-3 text-xs font-medium uppercase tracking-wider text-muted">{donation.category}</p>
      <Link
        to={href}
        className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary/90"
      >
        {actionLabel}
      </Link>
    </article>
  );
}
