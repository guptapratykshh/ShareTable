import { useEffect, useMemo, useState } from "react";
import { DonationCard } from "../../components/DonationCard";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ButtonLink, EmptyState, FilterPills, PageHeader, PageLoading, SectionToolbar } from "../../components/PageChrome";
import { MetricStrip } from "../../components/StatCard";
import { api, ApiError } from "../../services/api";
import type { Donation } from "../../types";

type Filter = "all" | "active" | "completed" | "expired";

function isActive(status: string) {
  return status === "ACTIVE" || status === "PARTIALLY_CLAIMED";
}

function isCompleted(status: string) {
  return status === "COMPLETED" || status === "FULLY_CLAIMED";
}

function isExpired(status: string) {
  return status === "EXPIRED" || status === "CANCELLED";
}

export function DonorDonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [rescued, setRescued] = useState({ meals: 0, rate: 0 });

  async function load() {
    const [d, dash] = await Promise.all([
      api<{ donations: Donation[] }>("/api/donations"),
      api<{ mealsRescued: number; rescueRate: number }>("/api/dashboard/donor").catch(() => ({ mealsRescued: 0, rescueRate: 0 })),
    ]);
    setDonations(d.donations);
    setRescued({ meals: dash.mealsRescued, rate: dash.rescueRate });
  }

  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const pending = donations.find((d) => d.id === pendingId);
  const visible = useMemo(() => {
    if (filter === "active") return donations.filter((d) => isActive(d.status));
    if (filter === "completed") return donations.filter((d) => isCompleted(d.status));
    if (filter === "expired") return donations.filter((d) => isExpired(d.status));
    return donations;
  }, [donations, filter]);

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
        eyebrow="Your activity"
        title="Donation history"
        subtitle="Track active listings, completed pickups, and food that still needs a second chance."
        actions={
          <ButtonLink to="/donor/donate">
            Donate surplus <span aria-hidden>↗</span>
          </ButtonLink>
        }
      />
      {error && <p className="text-alert">{error}</p>}
      <MetricStrip
        items={[
          { label: "Total listings", value: donations.length },
          { label: "Active now", value: donations.filter((d) => isActive(d.status)).length },
          { label: "Meals rescued", value: rescued.meals },
          { label: "Rescue rate", value: `${rescued.rate}%` },
        ]}
      />
      {donations.length === 0 && !error ? (
        <EmptyState
          title="No donations yet"
          body="Post surplus food to notify recipients within 2.5 km."
          action={<ButtonLink to="/donor/donate">Donate surplus food</ButtonLink>}
        />
      ) : (
        <>
          <SectionToolbar label="All donations" meta={`${visible.length} listing${visible.length === 1 ? "" : "s"}`}>
            <FilterPills
              value={filter}
              onChange={setFilter}
              options={[
                { id: "all", label: "All" },
                { id: "active", label: "Active" },
                { id: "completed", label: "Completed" },
                { id: "expired", label: "Expired" },
              ]}
            />
          </SectionToolbar>
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map((d) => (
              <DonationCard
                key={d.id}
                donation={d}
                actionLabel="View details"
                onRemove={isExpired(d.status) ? () => setPendingId(d.id) : undefined}
              />
            ))}
          </div>
          {visible.length === 0 && <EmptyState title="No listings in this filter" body="Try another status, or post a new surplus listing." />}
        </>
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
