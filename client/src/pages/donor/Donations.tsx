import { useEffect, useState } from "react";
import { DonationCard } from "../../components/DonationCard";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ButtonLink, EmptyState, PageHeader, PageLoading } from "../../components/PageChrome";
import { api, ApiError } from "../../services/api";
import type { Donation } from "../../types";

export function DonorDonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const d = await api<{ donations: Donation[] }>("/api/donations");
    setDonations(d.donations);
  }

  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
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

  if (loading) return <PageLoading label="Loading donations…" />;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="History"
        title="Donation history"
        subtitle="Active listings, pickups, and expired leftovers. Remove expired listings that were never rescued."
      />
      {error && <p className="text-alert">{error}</p>}
      {donations.length === 0 && !error ? (
        <EmptyState
          title="No donations yet"
          body="Post surplus food to notify recipients within 2.5 km."
          action={<ButtonLink to="/donor/donate">Donate surplus food</ButtonLink>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {donations.map((d) => (
            <DonationCard
              key={d.id}
              donation={d}
              actionLabel="View details"
              onRemove={["EXPIRED", "CANCELLED"].includes(d.status) ? () => setPendingId(d.id) : undefined}
            />
          ))}
        </div>
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
