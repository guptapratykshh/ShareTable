import { Clock3, MapPin, Utensils } from "lucide-react";
import type { Donation } from "../types";
import { formatRemaining, allergenLine } from "../utils/format";
import { useCountdown } from "../hooks/useCountdown";
import { RescueBadge, StatusBadge } from "./StatusBadge";
import { Button } from "./Form";
import { ButtonLink, IconTile } from "./PageChrome";

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
    <article className="flex h-full flex-col rounded-[18px] border border-border bg-card p-[22px] transition-all hover:-translate-y-0.5 hover:border-accent/40">
      <div className="mb-4 flex items-center justify-between gap-3">
        <IconTile>⌁</IconTile>
        <StatusBadge status={donation.status} />
      </div>
      <h3 className="display text-[23px] font-semibold leading-snug">{donation.foodName}</h3>
      <div className="mt-2.5">
        <RescueBadge band={donation.urgencyBand} label={donation.urgencyLabel} />
      </div>
      <div className="mt-5 grid gap-2 text-xs text-muted">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Utensils className="h-4 w-4 text-accent" />
          <span>
            <b className="text-accent">{donation.availableQuantity}</b> meals available
          </span>
        </p>
        {donation.distanceKm !== undefined && (
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {donation.distanceKm.toFixed(1)} km away
          </p>
        )}
        <p className="flex items-center gap-2">
          <Clock3 className="h-4 w-4" />
          {formatRemaining(donation.expiresAt)}
        </p>
        {donation.currentRadiusKm !== undefined && <p>◷ {donation.currentRadiusKm} km radius</p>}
        <p className="font-medium uppercase tracking-wider">{donation.category}</p>
        <p>{allergenLine(donation.allergens)}</p>
      </div>
      <div className={`mt-auto grid gap-2.5 pt-6 ${canRemove ? "grid-cols-2" : "grid-cols-1"}`}>
        <ButtonLink to={href} className="min-h-[42px] justify-center px-4 py-2.5 text-[11px]">
          {actionLabel} <span aria-hidden>→</span>
        </ButtonLink>
        {canRemove && (
          <Button type="button" variant="outline" className="min-h-[42px] px-4 py-2.5 text-[11px]" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
    </article>
  );
}
