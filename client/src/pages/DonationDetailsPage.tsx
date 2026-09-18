import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { MapContainer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { RescueBadge, StatusBadge } from "../components/StatusBadge";
import { Button, Field, inputClass } from "../components/Form";
import { PageHeader, PageLoading } from "../components/PageChrome";
import { ThemedTileLayer } from "../components/ThemedTileLayer";
import { ConfirmModal } from "../components/ConfirmModal";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../services/api";
import type { Claim, Donation } from "../types";
import { formatRemaining, formatTime, mapsUrl, allergenLine } from "../utils/format";
import { useCountdown } from "../hooks/useCountdown";

const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export function DonationDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const locationState = useLocation().state as { notified?: number } | null;
  const [donation, setDonation] = useState<Donation | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [myClaim, setMyClaim] = useState<Claim | undefined>();
  const [qty, setQty] = useState("10");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    locationState?.notified !== undefined ? `${locationState.notified} registered recipients notified within 2.5 km.` : "",
  );
  const [demoMode, setDemoMode] = useState(false);
  const [confirm, setConfirm] = useState<"cancel" | "remove" | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api<{ donation: Donation; claims?: Claim[]; myClaim?: Claim }>(`/api/donations/${id}`);
    setDonation(data.donation);
    setClaims(data.claims ?? []);
    setMyClaim(data.myClaim);
    const status = await api<{ demoMode?: boolean }>(`/api/donations/${id}/rescue-status`);
    setDemoMode(Boolean(status.demoMode));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [id]);

  useCountdown(donation?.expiresAt);

  async function claim(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const data = await api<{ donation: Donation; claim: Claim }>(`/api/donations/${id}/claim`, {
        method: "POST",
        body: JSON.stringify({ quantity: Number(qty) }),
      });
      setDonation(data.donation);
      setMyClaim(data.claim);
      setNotice(`${data.claim.quantity} meals reserved. ${data.donation.availableQuantity} still available.`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not claim meals.";
      setError(message);
      load().catch(() => undefined);
    }
  }

  async function demoEscalate() {
    if (!id) return;
    setError("");
    try {
      await api(`/api/donations/${id}/demo-escalate`, { method: "POST" });
      setNotice("Rescue radius expanded for the demo.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not escalate.");
    }
  }

  async function cancel() {
    if (!id) return;
    setError("");
    setBusy(true);
    try {
      await api(`/api/donations/${id}`, { method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) });
      setNotice("Listing cancelled. Recipients have been notified.");
      setConfirm(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not cancel this listing.");
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  async function removeUnused() {
    if (!id) return;
    setError("");
    setBusy(true);
    try {
      await api(`/api/donations/${id}`, { method: "DELETE" });
      navigate("/donor/donations");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove this listing.");
      setConfirm(null);
      setBusy(false);
    }
  }

  if (error && !donation) return <p className="text-alert">{error}</p>;
  if (!donation) return <PageLoading label="Loading donation…" />;

  const hasOpenReservation =
    Boolean(myClaim) && ["PICKUP_PENDING", "CLAIMED"].includes(myClaim!.status);
  const canClaim =
    user?.role === "RECIPIENT" &&
    !hasOpenReservation &&
    ["ACTIVE", "PARTIALLY_CLAIMED"].includes(donation.status) &&
    donation.availableQuantity > 0;

  return (
    <>
    <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">{donation.category}</p>
        <PageHeader title={donation.foodName} subtitle={donation.description} />
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={donation.status} />
          <RescueBadge band={donation.urgencyBand} label={donation.urgencyLabel} />
          <span className="text-sm text-muted">{formatRemaining(donation.expiresAt)}</span>
        </div>
        <p className="text-sm">{allergenLine(donation.allergens)}</p>
        <p className="text-xs text-muted">
          Donor-declared. ShareTable does not test meals and this is not a medical guarantee.
        </p>
        <div className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <p className="display text-4xl font-semibold tracking-tight">{donation.availableQuantity}</p>
          <p className="text-sm text-muted">meals available of {donation.quantity} posted</p>
          {donation.distanceKm !== undefined && (
            <p className="mt-2 text-sm">{donation.distanceKm.toFixed(1)} km away</p>
          )}
          <p className="mt-1 text-sm text-muted">Pickup before {formatTime(donation.expiresAt)}</p>
          <p className="mt-2 text-sm text-muted">
            Rescue level {donation.escalationLevel ?? 1} · radius {donation.currentRadiusKm ?? 2.5} km
          </p>
        </div>
        {notice && <p className="rounded-xl bg-primary/5 px-3 py-2 text-sm text-primary">{notice}</p>}
        {error && <p className="text-sm text-alert">{error}</p>}

        {canClaim && myClaim?.status === "PICKED_UP" && (
          <p className="text-sm text-muted">
            Your pickup was recorded. Remaining meals on this listing may be reserved as a new claim.
          </p>
        )}

        {canClaim && (
          <form onSubmit={claim} className="rounded-[1.5rem] border border-border bg-card p-5">
            <Field label="Meals to claim">
              <input className={inputClass} type="number" min={1} max={donation.availableQuantity} value={qty} onChange={(e) => setQty(e.target.value)} />
            </Field>
            <Button className="mt-3">Claim food</Button>
          </form>
        )}

        {myClaim && (
          <div className="rounded-[1.5rem] border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">Your reservation</p>
                <p className="mt-1 text-sm text-muted">{myClaim.quantity} meals</p>
              </div>
              {myClaim.claimCode ? (
                <p className="shrink-0 font-mono text-2xl font-semibold tracking-widest text-primary sm:text-3xl">
                  {myClaim.claimCode}
                </p>
              ) : null}
            </div>
            <Link to={`/claims/${myClaim.id}`} className="mt-3 inline-block text-sm font-medium text-primary">
              Open pickup details
            </Link>
          </div>
        )}

        {(user?.role === "DONOR" || user?.role === "ADMIN") &&
          demoMode &&
          ["ACTIVE", "PARTIALLY_CLAIMED"].includes(donation.status) && (
          <button type="button" onClick={demoEscalate} className="rounded-full border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary">
            Expand rescue radius (demo)
          </button>
        )}

        {user?.role === "DONOR" && ["ACTIVE", "PARTIALLY_CLAIMED", "FULLY_CLAIMED"].includes(donation.status) && (
          <Button type="button" variant="danger" onClick={() => setConfirm("cancel")}>
            Cancel this donation
          </Button>
        )}
        {user?.role === "DONOR" && ["EXPIRED", "CANCELLED"].includes(donation.status) && (
          <Button type="button" variant="danger" onClick={() => setConfirm("remove")}>
            Remove this listing
          </Button>
        )}
      </div>

      <aside className="space-y-4">
        {donation.location && (
          <div className="h-56 overflow-hidden rounded-2xl border border-border">
            <MapContainer center={[donation.location.lat, donation.location.lng]} zoom={15} className="h-full w-full">
              <ThemedTileLayer />
              <Marker position={[donation.location.lat, donation.location.lng]} icon={icon} />
            </MapContainer>
          </div>
        )}
        {donation.address && (
          <div className="rounded-[1.5rem] border border-border bg-card p-4 text-sm">
            <p className="font-semibold">Pickup</p>
            <p className="mt-1 text-muted">{donation.address}</p>
            {donation.pickupInstructions && <p className="mt-2 text-muted">{donation.pickupInstructions}</p>}
            {donation.location && (
              <a className="mt-3 inline-block font-medium text-primary" href={mapsUrl(donation.location.lat, donation.location.lng)} target="_blank" rel="noreferrer">
                Get directions
              </a>
            )}
          </div>
        )}
        {claims.length > 0 && (
          <div className="rounded-[1.5rem] border border-border bg-card p-4">
            <p className="font-semibold">Who claimed food</p>
            <ul className="mt-3 space-y-2 text-sm">
              {claims.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <span>
                    {c.recipient?.organizationName || c.recipient?.name} · {c.quantity} meals
                    {c.recipient?.reliabilityScore != null
                      ? ` · operational reliability ${c.recipient.reliabilityScore}`
                      : ""}
                  </span>
                  <Link to={`/claims/${c.id}`}>
                    <StatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
      <ConfirmModal
        open={confirm === "cancel"}
        title="Cancel this listing?"
        body="Recipients with a reservation will be notified. Pickup codes are not included in that message."
        confirmLabel="Cancel listing"
        cancelLabel="Keep listing"
        busy={busy}
        onCancel={() => {
          if (!busy) setConfirm(null);
        }}
        onConfirm={cancel}
      />
      <ConfirmModal
        open={confirm === "remove"}
        title="Remove this listing?"
        body={`${donation.foodName} will be removed from your history. Listings with recorded pickups stay so rescued meals still count.`}
        confirmLabel="Remove listing"
        busy={busy}
        onCancel={() => {
          if (!busy) setConfirm(null);
        }}
        onConfirm={removeUnused}
      />
    </>
  );
}
