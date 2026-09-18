import { Clock3, MapPin, Utensils } from "lucide-react";
import type { Donation } from "../types";
import { formatRemaining, allergenLine } from "../utils/format";
import { useCountdown } from "../hooks/useCountdown";
import { RescueBadge, StatusBadge } from "./StatusBadge";
import { Button } from "./Form";
import { ButtonLink } from "./PageChrome";

export function DonationCard({
  donation,
  actionLabel = "View & Claim",
  to,
  onRemove,
}: {
  donation: Donation;
  actionLabel?: string;
  to?: string;
  onRemove?: () => void;
}) {
  useCountdown(donation.expiresAt);
  const href = to ?? `/donation/${donation.id}`;
  const canRemove = Boolean(onRemove) && ["EXPIRED", "CANCELLED"].includes(donation.status);

  return (
    <article className="flex h-full flex-col rounded-[1.25rem] border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-accent/40">
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
      <p className="mt-1 text-xs text-muted">{allergenLine(donation.allergens)}</p>
      <div className={`mt-auto grid gap-2 pt-4 ${canRemove ? "grid-cols-2" : "grid-cols-1"}`}>
        <ButtonLink to={href} className="px-4 py-2.5">
          {actionLabel}
        </ButtonLink>
        {canRemove && (
          <Button type="button" variant="danger" className="px-4 py-2.5" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
    </article>
  );
}
