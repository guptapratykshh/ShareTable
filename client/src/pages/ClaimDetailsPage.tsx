import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Field, inputClass } from "../components/Form";
import { PageHeader, PageLoading } from "../components/PageChrome";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../services/api";
import type { Claim } from "../types";
import { formatTime, mapsUrl } from "../utils/format";

export function ClaimDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const data = await api<{ claim: Claim }>(`/api/claims/${id}`);
    setClaim(data.claim);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [id]);

  async function complete(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const data = await api<{ claim: Claim }>(`/api/claims/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ claimCode: code }),
      });
      setClaim(data.claim);
      setNotice("Pickup recorded. These meals now count as rescued.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not complete pickup.");
    }
  }

  if (error && !claim) return <p className="text-alert">{error}</p>;
  if (!claim) return <PageLoading label="Loading claim…" />;
  const donation = claim.donation;
  const canConfirm = user?.role === "DONOR" || user?.role === "ADMIN";
  const isCollector = user?.role === "RECIPIENT";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader
        eyebrow="Pickup"
        title={isCollector ? "Show this code at pickup" : "Confirm pickup"}
        subtitle={donation?.foodName}
      />
      <StatusBadge status={claim.status} />
      <div className="rounded-[1.5rem] border border-border bg-card p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <p className="display text-4xl font-semibold tracking-tight">{claim.quantity}</p>
        <p className="text-muted">{isCollector ? "meals reserved for you" : "meals reserved"}</p>
        {claim.claimCode && (
          <p className="mt-4 font-mono text-2xl tracking-widest">{claim.claimCode}</p>
        )}
        <p className="mt-1 text-xs text-muted">
          {isCollector
            ? "Show this code at pickup. The donor records the handoff. You cannot mark it picked up."
            : claim.claimCode
              ? "Pickup recorded. This code is a receipt of the handoff."
              : "Ask the collector to read their pickup code. Do not confirm until they are here."}
        </p>
        {donation?.address && <p className="mt-4 text-sm">Location: {donation.address}</p>}
        {donation?.distanceKm !== undefined && <p className="text-sm text-muted">{donation.distanceKm.toFixed(1)} km away</p>}
        <p className="text-sm text-muted">Pickup before {formatTime(claim.pickupDeadline)}</p>
        {donation?.pickupInstructions && <p className="mt-3 text-sm text-muted">{donation.pickupInstructions}</p>}
        {donation?.location && (
          <a className="mt-4 inline-block font-medium text-primary" href={mapsUrl(donation.location.lat, donation.location.lng)} target="_blank" rel="noreferrer">
            Get directions
          </a>
        )}
      </div>
      {notice && <p className="rounded-xl bg-primary/5 px-3 py-2 text-sm">{notice}</p>}
      {error && <p className="text-sm text-alert">{error}</p>}
      {canConfirm && claim.status !== "PICKED_UP" && (
        <form onSubmit={complete} className="rounded-[1.5rem] border border-border bg-card p-5">
          <Field label="Pickup code">
            <input className={inputClass} value={code} placeholder="ST-0000" onChange={(e) => setCode(e.target.value)} autoComplete="off" />
          </Field>
          <Button className="mt-3">Mark as picked up</Button>
        </form>
      )}
      {donation && (
        <Link to={`/donation/${donation.id}`} className="block text-sm text-primary">
          Back to donation
        </Link>
      )}
    </div>
  );
}
