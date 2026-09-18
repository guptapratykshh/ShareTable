import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmModal } from "../../components/ConfirmModal";
import { Button, Field, inputClass } from "../../components/Form";
import { PageLoading } from "../../components/PageChrome";
import { StatusBadge } from "../../components/StatusBadge";
import { api, ApiError } from "../../services/api";
import type { Claim } from "../../types";
import { formatDateTime } from "../../utils/format";
import { AdminHeader, AdminLink } from "./AdminChrome";

export function ClaimDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [status, setStatus] = useState("PICKUP_PENDING");
  const [claimCode, setClaimCode] = useState("");

  async function load() {
    const data = await api<{ claim: Claim }>(`/api/admin/claims/${id}`);
    setClaim(data.claim);
    setQuantity(String(data.claim.quantity));
    setStatus(data.claim.status);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [id]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!claim) return;
    setError("");
    setNotice("");
    setPending(true);
    try {
      const data = await api<{ claim: Claim }>(`/api/admin/claims/${claim.id}`, {
        method: "PUT",
        body: JSON.stringify({
          quantity: Number(quantity),
          status,
          claimCode: status === "PICKED_UP" ? claimCode : undefined,
        }),
      });
      setClaim(data.claim);
      setNotice(status === "PICKED_UP" ? "Pickup recorded. These meals now count as rescued." : "Claim updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update claim.");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!claim) return;
    setPending(true);
    try {
      await api(`/api/admin/claims/${claim.id}`, { method: "DELETE" });
      navigate("/admin/claims");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete claim.");
      setConfirm(false);
    } finally {
      setPending(false);
    }
  }

  if (error && !claim) return <p className="text-alert">{error}</p>;
  if (!claim) return <PageLoading label="Loading claim…" />;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <AdminHeader
        eyebrow="Claim"
        title={claim.donation?.foodName ?? "Claim"}
        subtitle={`${claim.quantity} meals · claimed ${formatDateTime(claim.claimedAt)}`}
        actions={
          <Link to="/admin/claims" className="text-sm font-semibold text-muted">
            Back to claims
          </Link>
        }
      />
      <StatusBadge status={claim.status} />
      {claim.recipient && (
        <p className="text-sm">
          Collector: <AdminLink to={`/admin/users/${claim.recipient.id}`}>{claim.recipient.organizationName || claim.recipient.name}</AdminLink>
        </p>
      )}
      {claim.donation && (
        <p className="text-sm">
          Listing: <AdminLink to={`/admin/listings/${claim.donation.id}`}>{claim.donation.foodName}</AdminLink>
        </p>
      )}
      {claim.claimCode && (
        <div className="rounded-[1.5rem] border border-border bg-card p-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-muted">Pickup code</p>
          <p className="mt-2 font-mono text-3xl tracking-widest">{claim.claimCode}</p>
          <p className="mt-2 text-xs text-muted">Shown on admin claim detail only.</p>
        </div>
      )}
      {error && <p className="text-sm text-alert">{error}</p>}
      {notice && <p className="rounded-xl bg-primary/5 px-3 py-2 text-sm">{notice}</p>}

      <form onSubmit={save} className="space-y-4 rounded-[1.5rem] border border-border bg-card p-6">
        <Field label="Quantity">
          <input
            className={inputClass}
            type="number"
            min={1}
            value={quantity}
            disabled={claim.status === "PICKED_UP"}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
        <Field label="Status">
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)} disabled={claim.status === "PICKED_UP"}>
            <option value="PICKUP_PENDING">Pickup pending</option>
            <option value="PICKED_UP">Picked up</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="NO_SHOW">No show</option>
          </select>
        </Field>
        {status === "PICKED_UP" && claim.status !== "PICKED_UP" && (
          <Field label="Pickup code">
            <input
              className={inputClass}
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value)}
              placeholder="Required to record pickup"
            />
          </Field>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending || claim.status === "PICKED_UP"}>
            {pending ? "Saving…" : "Save claim"}
          </Button>
          <Button type="button" variant="danger" onClick={() => setConfirm(true)} disabled={claim.status === "PICKED_UP"}>
            Delete
          </Button>
        </div>
      </form>

      <ConfirmModal
        open={confirm}
        title="Delete this claim?"
        body="Picked-up claims cannot be deleted because they count as rescued meals."
        confirmLabel="Delete claim"
        cancelLabel="Keep claim"
        busy={pending}
        onConfirm={remove}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
