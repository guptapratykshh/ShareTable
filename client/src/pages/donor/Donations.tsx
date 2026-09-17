import { useEffect, useState } from "react";
import { DonationCard } from "../../components/DonationCard";
import { ConfirmModal } from "../../components/ConfirmModal";
import { api, ApiError } from "../../services/api";
import type { Donation } from "../../types";

export function DonorDonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const d = await api<{ donations: Donation[] }>("/api/donations");
    setDonations(d.donations);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  const pending = donations.find((d) => d.id === pendingId);

  async function confirmRemove() {
    if (!pendingId) return;
    setError("");
    setBusy(true);
    try {
      await api(`/api/donations/${pendingId}`, { method: "DELETE" });
      setDonations((prev) => prev.filter((d) => d.id !== pendingId));
      setPendingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove this listing.");
      setPendingId(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="display text-4xl font-semibold tracking-tight">Donation history</h1>
      <p className="mt-2 text-muted">Active listings, pickups, and expired leftovers. Remove expired listings that were never rescued.</p>
      {error && <p className="mt-4 text-alert">{error}</p>}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {donations.map((d) => (
          <DonationCard
            key={d.id}
            donation={d}
            actionLabel="View details"
            onRemove={["EXPIRED", "CANCELLED"].includes(d.status) ? () => setPendingId(d.id) : undefined}
          />
        ))}
      </div>
      {donations.length === 0 && !error && (
        <p className="mt-6 rounded-[1.5rem] bg-secondary p-8 text-center text-sm text-muted">No donations yet.</p>
      )}
      <ConfirmModal
        open={Boolean(pendingId)}
        title="Remove this listing?"
        body={
          pending
            ? `${pending.foodName} will be removed from your history. Listings with recorded pickups stay so rescued meals still count.`
            : "This listing will be removed from your history."
        }
        confirmLabel="Remove listing"
        busy={busy}
        onCancel={() => {
          if (!busy) setPendingId(null);
        }}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
