import { ArrowRight, Utensils } from "lucide-react";
import { Link } from "react-router-dom";
import type { Donation } from "../types";
import { formatRemaining } from "../utils/format";
import { useCountdown } from "../hooks/useCountdown";
import { StatusBadge } from "./StatusBadge";

export function DonationCard({
  donation,
  actionLabel = "View listing",
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
  const claimable = donation.status === "ACTIVE" || donation.status === "PARTIALLY_CLAIMED";
  const radius =
    donation.currentRadiusKm != null
      ? `${donation.currentRadiusKm} km`
      : donation.distanceKm != null
        ? `${donation.distanceKm.toFixed(1)} km`
        : null;

  return (
    <article className="flex items-center gap-3.5 py-3.5">
      <div
        className={`grid size-[37px] shrink-0 place-items-center rounded-lg ${
          claimable ? "bg-rescued/20 text-rescued" : "bg-secondary text-foreground"
        }`}
      >
        <Utensils size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-[13px] font-semibold tracking-tight">{donation.foodName}</h3>
          <StatusBadge status={donation.status} />
        </div>
        <p className="mt-1.5 text-[10px] text-muted">
          {donation.urgencyLabel} · {donation.category} · {formatRemaining(donation.expiresAt)}
        </p>
      </div>
      <div className="hidden min-w-[75px] gap-0.5 sm:grid">
        <strong className="text-[13px]">{donation.availableQuantity}</strong>
        <span className="text-[9px] text-muted">meals left</span>
      </div>
      {radius ? (
        <div className="hidden min-w-[75px] gap-0.5 sm:grid">
          <strong className="text-[13px]">{radius}</strong>
          <span className="text-[9px] text-muted">pickup radius</span>
        </div>
      ) : null}
      {canRemove ? (
        <button type="button" className="text-[10px] font-extrabold text-muted hover:text-alert" onClick={onRemove}>
          Remove
        </button>
      ) : null}
      <Link
        to={href}
        aria-label={actionLabel}
        className="grid size-[30px] shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
      >
        <ArrowRight size={16} />
      </Link>
    </article>
  );
}
